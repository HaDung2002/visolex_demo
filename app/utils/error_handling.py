class ViSoLexException(Exception):
    """Base exception for ViSoLex demo errors."""


class TextProcessingError(ViSoLexException):
    """Raised when user input cannot be processed."""


class ModelLoadError(ViSoLexException):
    """Raised when the ViSoNorm model cannot be loaded."""

