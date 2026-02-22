"""
server.py — Flask-SocketIO Bridge between CNN Model and Dashboard

HOW IT WORKS:
  1. Loads your face_model.h5 and labels.json
  2. Opens the webcam and runs predictions every frame
  3. Emits 'face_detection' via WebSocket to the dashboard
  4. Dashboard workers.js receives it and starts the timer

HOW TO RUN:
  pip install flask flask-socketio flask-cors tensorflow opencv-python numpy
  python server.py

Then open your index.html in a browser (or use Live Server in VS Code).
"""

import cv2
import numpy as np
import json
import time
import re
import serial
import serial.tools.list_ports
from flask import Flask, Response
from flask_socketio import SocketIO
from flask_cors import CORS
from tensorflow.keras.models import load_model
import threading

app = Flask(__name__)
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ── CONFIG ────────────────────────────────
MODEL_PATH  = "face_model.h5"
LABELS_PATH = "labels.json"
CONFIDENCE_THRESHOLD = 0.75   # Ignore predictions below this (0.0 - 1.0)
DETECTION_INTERVAL   = 0.5    # Seconds between predictions (lower = faster but heavier)

# ── SERIAL / ESP32 CONFIG ─────────────────
SERIAL_PORT = 'COM5'      # ESP32 port
SERIAL_BAUD = 115200      # Must match Serial.begin(115200) in your .ino

# ── LOAD MODEL ────────────────────────────
print("Loading model...")
model = load_model(MODEL_PATH)

with open(LABELS_PATH, "r") as f:
    class_indices = json.load(f)

labels = {v: k for k, v in class_indices.items()}
print(f"Model loaded. Labels: {labels}")

# ── SHARED FRAME (for MJPEG stream) ──────
latest_frame = None
frame_lock   = threading.Lock()

# ── STATE ─────────────────────────────────
# Tracks who is currently visible so we can send 'face_lost' when they disappear
currently_visible = {}   # { label: last_seen_timestamp }
LOST_TIMEOUT = 3         # seconds — if not seen for this long, emit face_lost

# ── SERIAL READER THREAD ──────────────────
# Reads DHT11 data from ESP32 over USB serial and emits to dashboard
def serial_loop():
    port = SERIAL_PORT

    # Auto-detect port if not found
    if not port:
        ports = serial.tools.list_ports.comports()
        for p in ports:
            if 'USB' in p.description or 'CH340' in p.description or 'CP210' in p.description:
                port = p.device
                print(f"Auto-detected ESP32 on {port}")
                break

    if not port:
        print("WARNING: No ESP32 serial port found. Temperature will use simulated data.")
        return

    try:
        ser = serial.Serial(port, SERIAL_BAUD, timeout=2)
        print(f"ESP32 connected on {port} at {SERIAL_BAUD} baud")
    except Exception as e:
        print(f"WARNING: Could not open serial port {port}: {e}")
        print("Temperature will use simulated data.")
        return

    # Patterns for different serial message types
    temp_pattern = re.compile(r'Temperature:\s*([\d.]+).*?Humidity:\s*([\d.]+)', re.IGNORECASE)

    # LED → pole mapping: LED index → pole ID
    LED_TO_POLE = {0: 'P-01', 1: 'P-02', 2: 'P-03'}

    print("Waiting 4s for ESP32 to finish booting...")
    time.sleep(4)
    ser.reset_input_buffer()

    while True:
        try:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if not line:
                continue

            # DEBUG — print every raw line so we can see exactly what ESP32 sends
            print(f"RAW: {repr(line)}")

            # ── Temperature reading ───────────────
            temp_match = temp_pattern.search(line)
            if temp_match:
                temperature = float(temp_match.group(1))
                humidity    = float(temp_match.group(2))
                print(f"ESP32 → Temp: {temperature}°C | Humidity: {humidity}%")
                socketio.emit('temperature', {
                    'temperature': temperature,
                    'humidity':    humidity,
                })

            # ── Wire break triggered ──────────────
            # Just a signal that toggling has started.
            # The LED: messages will tell us which pole is broken each moment.
            elif line == 'POLE:BREAK':
                print("ESP32 → Wire break toggling started")
                log_msg = "ESP32: Wire break detected — LEDs toggling"
                socketio.emit('esp32_log', {'msg': log_msg})

            # ── Poles reset to normal ─────────────
            elif line == 'POLE:RESET':
                print("ESP32 → All poles restored")
                for pole_id in ['P-01', 'P-02', 'P-03']:
                    socketio.emit('pole_status', {'pole': pole_id, 'status': 'ok', 'voltage': 220})

            # ── Individual LED state change → pole break/restore ──
            # POLE_BREAK:0 → P-01 broken
            # POLE_BREAK:1 → P-02 broken
            # POLE_BREAK:2 → P-03 broken
            # POLE_OK:0    → P-01 restored
            elif line.startswith('POLE_BREAK:') or line.startswith('POLE_OK:'):
                try:
                    parts     = line.split(':')
                    event     = parts[0]       # POLE_BREAK or POLE_OK
                    led_index = int(parts[1])  # 0, 1, or 2
                    pole_id   = LED_TO_POLE.get(led_index)

                    if pole_id:
                        if event == 'POLE_BREAK':
                            socketio.emit('pole_status', {
                                'pole': pole_id, 'status': 'broken', 'voltage': 0
                            })
                            print(f"ESP32 → {pole_id} BROKEN (LED{led_index} changed state)")
                        else:
                            socketio.emit('pole_status', {
                                'pole': pole_id, 'status': 'ok', 'voltage': 220
                            })
                            print(f"ESP32 → {pole_id} RESTORED (LED{led_index} changed state)")
                except Exception as e:
                    print(f"Pole parse error: {e}")

            else:
                print(f"ESP32: {line}")

        except Exception as e:
            print(f"Serial read error: {e}")
            time.sleep(2)


# ── CAMERA THREAD ─────────────────────────
def camera_loop():
    global latest_frame
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Could not open camera")
        return

    print("Camera started. Running detections...")

    last_prediction_time = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Camera read failed")
            break

        now = time.time()

        # Store latest frame for MJPEG stream
        ret_jpg, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ret_jpg:
            with frame_lock:
                latest_frame = buffer.tobytes()

        # Only predict every DETECTION_INTERVAL seconds (saves CPU)
        if now - last_prediction_time >= DETECTION_INTERVAL:
            last_prediction_time = now

            # Preprocess
            img = cv2.resize(frame, (224, 224))
            img_array = img / 255.0
            img_array = np.expand_dims(img_array, axis=0)

            # Predict
            pred        = model.predict(img_array, verbose=0)
            confidence  = float(np.max(pred))
            pred_class  = labels[int(np.argmax(pred))]

            if confidence >= CONFIDENCE_THRESHOLD:
                # Valid detection — emit to dashboard
                currently_visible[pred_class] = now
                socketio.emit('face_detection', {
                    'label':      pred_class,
                    'confidence': round(confidence, 4),  # 0.0 to 1.0
                })
                print(f"Detected: {pred_class} ({confidence:.2%})")
            else:
                print(f"Low confidence ({confidence:.2%}) — skipped")

        # Check for people who disappeared
        now = time.time()
        lost = [label for label, last_seen in list(currently_visible.items())
                if now - last_seen > LOST_TIMEOUT]
        for label in lost:
            del currently_visible[label]
            socketio.emit('face_lost', {'label': label})
            print(f"Lost: {label}")

        # (Preview window removed — feed is now served via /video_feed in the browser)

    cap.release()


# ── MJPEG STREAM ROUTE ────────────────────
def generate_frames():
    while True:
        with frame_lock:
            frame = latest_frame
        if frame:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        time.sleep(0.03)  # ~30 fps cap

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


# ── SOCKET EVENTS ─────────────────────────
@socketio.on('connect')
def on_connect():
    print("Dashboard connected via WebSocket")
    # Confirm socket is working by sending a test pole restore on connect
    socketio.emit('pole_status', {'pole': 'P-01', 'status': 'ok', 'voltage': 220})

@socketio.on('disconnect')
def on_disconnect():
    print("Dashboard disconnected")


# ── MAIN ──────────────────────────────────
if __name__ == '__main__':
    # Start serial reader for ESP32 temperature sensor
    serial_thread = threading.Thread(target=serial_loop, daemon=True)
    serial_thread.start()

    # Start camera in background thread
    cam_thread = threading.Thread(target=camera_loop, daemon=True)
    cam_thread.start()

    print("Starting Flask-SocketIO server on http://localhost:5000")
    print("Open your dashboard in the browser now.")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)
