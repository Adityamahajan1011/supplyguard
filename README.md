#SupplyGuard 
AI-Powered Industrial Safety & Infrastructure Monitoring System

SupplyGuard is a real-time industrial safety platform that integrates Artificial Intelligence and IoT-based hardware modules to detect infrastructure faults, monitor environmental conditions, and track worker presence.

The system is designed to enhance workplace safety, reduce supply chain disruptions, and automate supervision through intelligent monitoring and live analytics.

#Project Overview

SupplyGuard combines:

Environmental condition monitoring

Electrical fault detection in infrastructure

AI-based face recognition and presence tracking

All modules are integrated into a centralized real-time web dashboard for continuous industrial supervision.

#Core Features
##Real-Time Temperature Monitoring (DHT11 Sensor)

The system uses a DHT11 temperature sensor for live environmental monitoring.

Continuous real-time temperature readings

Configurable safety threshold

Automatic alert generation when temperature exceeds defined limits

Dashboard visualization of live data

This ensures safe operating conditions and helps prevent heat-related industrial risks.

##Pole Monitoring System (Electrical Fault Detection Module)

A custom-built hardware safety module detects potential wire breakage or abnormal electrical activity.

Working Principle:

A coil antenna is placed near electrical wiring.

If a wire is damaged or partially broken, residual current may still flow, generating a weak magnetic field.

The coil antenna detects this magnetic field.

The weak signal is passed through an amplification circuit.

The amplified signal is fed into a counter module.

An LED indicator blinks when abnormal pulses are detected.

This module enables early detection of electrical faults and provides immediate visual alerts to prevent accidents.

##AI Face Recognition & Presence Tracking

SupplyGuard includes an AI-powered monitoring system using a webcam for real-time detection.

Custom Convolutional Neural Network (CNN) trained on a dataset (20+ images per individual)

Real-time face detection and recognition via webcam

Displays:

Predicted name

Confidence score

Automated presence timer:

Starts when a recognized person enters the frame

Pauses when the person leaves

Resumes upon re-entry

This feature enables automated attendance tracking and workforce monitoring.

## Unified Real-Time Dashboard

Centralized web-based dashboard

Displays:

Temperature readings

Fault detection status

Recognized individuals and presence duration

Real-time updates from both hardware and AI modules

 ##Technology Stack
Software

Python

OpenCV

TensorFlow / Keras (CNN model)

Flask / Streamlit (Web Dashboard)

##Hardware

DHT11 temperature sensor

Coil antenna (magnetic field detection)

Signal amplification circuit

Counter module

LED alert system

Microcontroller (Arduino / ESP32)

Webcam (for real-time face recognition)

## System Workflow

The DHT11 sensor continuously monitors environmental temperature.

The coil antenna detects magnetic fields caused by residual current in faulty wiring.

Signals are amplified and processed; faults trigger LED alerts.

The webcam captures live video for AI-based face recognition.

Presence tracking runs automatically.

All outputs are displayed on the centralized dashboard in real time.
 Installation & Setup

Hardware configuration may vary depending on the microcontroller and sensor connections.

## Project Structure




