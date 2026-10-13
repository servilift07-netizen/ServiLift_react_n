"""Hora de Colombia y validación de la configuración."""
from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.tiempo import ZONA, a_local, con_zona


def test_a_local_converts_an_utc_date_to_colombia_time_without_zone():
    # Arrange: 15:00 UTC son las 10:00 en Colombia (UTC-5)
    utc = datetime(2026, 10, 12, 15, 0, tzinfo=timezone.utc)

    # Act
    local = a_local(utc)

    # Assert
    assert local == datetime(2026, 10, 12, 10, 0) and local.tzinfo is None


def test_a_local_keeps_a_date_that_already_has_no_zone():
    assert a_local(datetime(2026, 10, 12, 10, 0)) == datetime(2026, 10, 12, 10, 0)


def test_a_local_of_none_is_none():
    assert a_local(None) is None


def test_con_zona_adds_the_colombia_offset_to_a_database_date():
    v = con_zona(datetime(2026, 10, 12, 10, 0))

    assert v.utcoffset() == timedelta(hours=-5) and v.tzinfo == ZONA


def test_con_zona_does_not_change_a_date_that_already_has_a_zone():
    utc = datetime(2026, 10, 12, 15, 0, tzinfo=timezone.utc)

    assert con_zona(utc) is utc


# ---------------------------------------------------------------- configuración
def test_settings_builds_the_database_url_from_its_parts():
    s = Settings(_env_file=None, DB_USER="u", DB_PASSWORD="p", DB_HOST="h", DB_PORT="3307", DB_NAME="servilift_v2_prueba")

    assert s.DATABASE_URL == "mysql+pymysql://u:p@h:3307/servilift_v2_prueba?charset=utf8mb4"


def test_settings_splits_and_trims_the_allowed_origins():
    s = Settings(_env_file=None, CORS_ORIGINS=" https://a.co , ,https://b.co")

    assert s.cors_origins == ["https://a.co", "https://b.co"]


@pytest.mark.parametrize("zona", ["-5:00", "UTC", "-05", "05:00"])
def test_settings_rejects_a_time_zone_without_the_offset_format(zona):
    with pytest.raises(ValidationError, match="ZONA_HORARIA"):
        Settings(_env_file=None, ZONA_HORARIA=zona)


@pytest.mark.parametrize("zona", ["-05:00", "+00:00"])
def test_settings_accepts_a_time_zone_offset(zona):
    assert Settings(_env_file=None, ZONA_HORARIA=zona).ZONA_HORARIA == zona
