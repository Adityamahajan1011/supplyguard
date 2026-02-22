import cv2
import numpy as np
import json
from tensorflow.keras.models import load_model

print("Script started")

# Load model
model = load_model("face_model.h5")

# Load labels
with open("labels.json", "r") as f:
    class_indices = json.load(f)

labels = {v: k for k, v in class_indices.items()}

print("Model and labels loaded")

# Start webcam
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Camera not working")
    exit()

print("Camera started")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Resize for model
    img = cv2.resize(frame, (224, 224))
    img_array = img / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    # Prediction
    pred = model.predict(img_array, verbose=0)
    confidence = np.max(pred)
    pred_class = labels[np.argmax(pred)]

    # Show text on frame
    text = f"{pred_class} ({confidence:.2f})"
    cv2.putText(frame, text, (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    cv2.imshow("Face Recognition", frame)

    # Press Q to exit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()