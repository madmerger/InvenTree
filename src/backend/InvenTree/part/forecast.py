"""Stock quantity forecasting for Part instances.

The forecasting method is intentionally isolated in this module,
so that the underlying implementation (statistical, machine learning,
external service, ...) can be replaced without touching the API layer.
"""

import datetime
import math
from dataclasses import dataclass

# Default forecast horizon (days)
DEFAULT_HORIZON_DAYS = 30

# Number of standard deviations used for the confidence interval
CONFIDENCE_FACTOR = 1.96


@dataclass
class ForecastPoint:
    """A single point in a forecast series."""

    date: datetime.date
    quantity: float
    lower: float
    upper: float

    def to_dict(self) -> dict:
        """Return a serializable representation of this point."""
        return {
            'date': self.date,
            'quantity': self.quantity,
            'lower': self.lower,
            'upper': self.upper,
        }


def _historical_data(part_id: int) -> list[tuple[datetime.date, float]]:
    """Return the stocktake history for the specified part.

    Returns a list of (date, quantity) tuples, sorted by date.
    """
    from part.models import PartStocktake

    entries = (
        PartStocktake.objects
        .filter(part=part_id)
        .order_by('date')
        .values('date', 'quantity')
    )

    return [(entry['date'], float(entry['quantity'])) for entry in entries]


def _linear_fit(x: list[float], y: list[float]) -> tuple[float, float, float]:
    """Perform a simple ordinary least squares fit.

    Returns a tuple of (slope, intercept, residual standard deviation).
    """
    n = len(x)

    mean_x = sum(x) / n
    mean_y = sum(y) / n

    variance = sum((xi - mean_x) ** 2 for xi in x)

    if variance == 0:
        slope = 0.0
    else:
        slope = (
            sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y, strict=True))
            / variance
        )

    intercept = mean_y - slope * mean_x

    residuals = [yi - (slope * xi + intercept) for xi, yi in zip(x, y, strict=True)]

    sigma = math.sqrt(sum(r**2 for r in residuals) / (n - 2)) if n > 2 else 0.0

    return slope, intercept, sigma


def forecast_stock(
    part_id: int, horizon_days: int = DEFAULT_HORIZON_DAYS
) -> list[dict]:
    """Forecast the stock quantity for the specified part.

    Arguments:
        part_id: Primary key of the Part to forecast
        horizon_days: Number of days to forecast into the future

    Returns:
        A list of dicts, each with 'date', 'quantity', 'lower' and 'upper' keys.
        An empty list is returned if no historical data is available.
    """
    horizon_days = max(int(horizon_days), 0)

    history = _historical_data(part_id)

    if len(history) == 0 or horizon_days == 0:
        return []

    start_date = history[-1][0]

    if len(history) < 2:
        # Insufficient data for a trend: fall back to a flat forecast
        quantity = history[-1][1]
        return [
            ForecastPoint(
                date=start_date + datetime.timedelta(days=day),
                quantity=quantity,
                lower=quantity,
                upper=quantity,
            ).to_dict()
            for day in range(1, horizon_days + 1)
        ]

    # Convert dates into "days since first observation"
    origin = history[0][0]

    x = [float((entry[0] - origin).days) for entry in history]
    y = [entry[1] for entry in history]

    slope, intercept, sigma = _linear_fit(x, y)

    forecast = []

    for day in range(1, horizon_days + 1):
        date = start_date + datetime.timedelta(days=day)
        offset = float((date - origin).days)

        quantity = slope * offset + intercept

        # Uncertainty grows with the distance from the observed data
        interval = CONFIDENCE_FACTOR * sigma * math.sqrt(1 + day / len(history))

        forecast.append(
            ForecastPoint(
                date=date,
                quantity=max(quantity, 0.0),
                lower=max(quantity - interval, 0.0),
                upper=max(quantity + interval, 0.0),
            ).to_dict()
        )

    return forecast
