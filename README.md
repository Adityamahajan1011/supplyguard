# SupplyGuard

## AI-Powered Industrial Safety & Infrastructure Monitoring System

SupplyGuard is a real-time industrial safety platform that integrates **Artificial Intelligence** and **IoT-based hardware modules** to detect infrastructure faults, monitor environmental conditions, and track worker presence.

The system is designed to enhance workplace safety, reduce supply chain disruptions, and automate supervision through intelligent monitoring and live analytics.

---

# Project Overview

SupplyGuard combines the following core capabilities:

* Environmental condition monitoring
* Electrical fault detection in infrastructure
* AI-based face recognition and presence tracking

All modules are integrated into a **centralized real-time web dashboard** for continuous industrial supervision.

---

# Core Features

## Real-Time Temperature Monitoring (DHT11 Sensor)

The system uses a **DHT11 temperature sensor** for live environmental monitoring.

* Continuous real-time temperature readings
* Configurable safety threshold
* Automatic alert generation when temperature exceeds defined limits
* Dashboard visualization of live data

This ensures safe operating conditions and helps prevent heat-related industrial risks.

---

## Pole Monitoring System (Electrical Fault Detection Module)

A custom-built hardware safety module detects potential wire breakage or abnormal electrical activity.

### Working Principle

* A **coil antenna** is placed near electrical wiring.
* If a wire is damaged or partially broken, residual current may still flow, generating a weak magnetic field.
* The coil antenna detects this magnetic field.
* The weak signal is passed through an amplification circuit.
* The amplified signal is fed into a counter module.
* An LED indicator blinks when abnormal pulses are detected.

This module enables early detection of electrical faults and provides immediate visual alerts to prevent accidents.

---

## AI Face Recognition & Presence Tracking

SupplyGuard includes an AI-powered monitoring system using a **webcam** for real-time detection.

* Custom Convolutional Neural Network (CNN) trained on a dataset (20+ images per individual)
* Real-time face detection and recognition via webcam
* Displays:

  * Predicted name
  * Confidence score

### Automated Presence Timer

* Starts when a recognized person enters the frame
* Pauses when the person leaves
* Resumes upon re-entry

This feature enables automated attendance tracking and workforce monitoring.

---

## Unified Real-Time Dashboard

A centralized web-based dashboard that displays:

* Temperature readings
* Fault detection status
* Recognized individuals and presence duration
* Real-time updates from both hardware and AI modules

---

# Technology Stack

## Software

* Python
* OpenCV
* TensorFlow / Keras (CNN Model)
* Flask / Streamlit (Web Dashboard)

## Hardware

* DHT11 Temperature Sensor
* Coil Antenna (Magnetic Field Detection)
* Signal Amplification Circuit
* Counter Module
* LED Alert System
* Microcontroller (Arduino / ESP32)
* Webcam (Real-Time Face Recognition)

---

# System Workflow

1. The DHT11 sensor continuously monitors environmental temperature.
2. The coil antenna detects magnetic fields caused by residual current in faulty wiring.
3. Signals are amplified and processed; faults trigger LED alerts.
4. The webcam captures live video for AI-based face recognition.
5. Presence tracking runs automatically.
6. All outputs are displayed on the centralized dashboard in real time.

---

# Installation & Setup

Hardware configuration may vary depending on the microcontroller and sensor connections.

(Software setup instructions can be added here if required.)

---
*Setup Guide*
1. Clone the repo as zip file on your computer
2. Right Click on that folder and select EXTRACT ALL .
3. Open CMD
4. Install all the python libraries also this model contains some packages which could only run on python 3.10 version...due to which we have to set a virtual environment for the same
5. pip install tensorflow opencv-python numpy flask flask-socketio requests pillow eventlet
6. Navigate to the project directory and type 'python server.py'
7. Open the index file on your browser and test the website.
# Project Structure
```
supplyguard/                        ← ROOT (run server.py from here)
│
├── index.html                      ← unchanged
├── server.py                       ← PUT HERE (move out of face_recognition_project)
├── README.md                       ← unchanged
├── ESP32 code                      ← unchanged
│
├── css/
│   └── styles.css                  ← unchanged
│
├── js/
│   ├── app.js                      ← unchanged
│   ├── poles.js                    ← unchanged
│   ├── temperature.js              ← unchanged
│   └── workers.js                  ← REPLACE with new version
│
└── face_recognition_project/
    ├── face_model.h5               ← unchanged
    ├── labels.json                 ← unchanged
    └── realtime_face.py            ← REPLACE with new version
```



