import os


class Config:
    """Base configuration for the ViSoLex demo application."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "visolex-demo-secret-key")
    MODEL_REPO = os.environ.get(
        "VISONORM_MODEL_REPO", "hadung1802/visobert-normalizer-mix100"
    )
    DEVICE = os.environ.get("VISONORM_DEVICE", "cpu")
    LOG_LEVEL = os.environ.get("VISONORM_LOG_LEVEL", "INFO")
    MAX_TEXT_LENGTH = int(os.environ.get("VISONORM_MAX_TEXT_LENGTH", 5000))
    MAX_BATCH_SIZE = int(os.environ.get("VISONORM_MAX_BATCH_SIZE", 20))


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False

