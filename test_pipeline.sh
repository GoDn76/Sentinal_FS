#!/usr/bin/env bash
# SentinelFS Integration & Stress Test Harness Shell Script
set -e

echo "=========================================================================="
echo "    SentinelFS End-to-End Forensic Integration & Stress-Test Pipeline"
echo "=========================================================================="

python test_pipeline.py "$@"

echo "=========================================================================="
echo "Harness execution complete. Summary saved to test_pipeline_report.json"
echo "=========================================================================="
