import logging
import os

from flask import Flask

from config import Config
from .api import api_bp
from .models.normalizer import ViSoNormModel
from .utils.error_handling import ModelLoadError


def configure_logging(log_level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


def create_app(config_class: type[Config] = Config) -> Flask:
    # Get the root directory (parent of app/)
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_folder = os.path.join(root_dir, "static")
    template_folder = os.path.join(root_dir, "app", "templates")
    
    app = Flask(
        __name__,
        static_folder=static_folder,
        template_folder=template_folder,
    )
    app.config.from_object(config_class)

    configure_logging(app.config["LOG_LEVEL"])
    logger = logging.getLogger(__name__)

    try:
        viso_model = ViSoNormModel(
            model_repo=app.config["MODEL_REPO"],
            device=app.config["DEVICE"],
            max_text_length=app.config["MAX_TEXT_LENGTH"],
        )
        app.config["VISONORM_MODEL"] = viso_model
        logger.info(
            "ViSoNorm model initialized (repo=%s, device=%s)",
            app.config["MODEL_REPO"],
            app.config["DEVICE"],
        )
    except ModelLoadError as exc:
        logger.error("Failed to load ViSoNorm model: %s", exc)
        raise

    app.register_blueprint(api_bp, url_prefix="/api")

    @app.route("/")
    def index():
        from flask import render_template

        return render_template("index.html")

    return app

