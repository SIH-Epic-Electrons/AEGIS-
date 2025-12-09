"""
AEGIS Federated Learning Module

Privacy-preserving cross-bank fraud detection training.
Enables banks to collaboratively train models without sharing sensitive data.
"""

from .config import fl_config, AggregationStrategy

__all__ = ["fl_config", "AggregationStrategy"]

