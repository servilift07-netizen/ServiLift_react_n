"""Contraseñas sin bcrypt: columna usuario.contrasena_encriptada (BLOB) con sal + PBKDF2-SHA256.

Un hash bcrypt no se puede convertir (no se sabe la contraseña original), así que todos los usuarios
existentes quedan con la contraseña de demostración 123456 en el formato nuevo; cada uno con su propia sal.
Para volver atrás (downgrade) pasa lo mismo al revés: se necesitaría bcrypt, que ya no se usa, así que
el downgrade solo restaura la columna anterior vacía y no se recomienda.

Revisión: 0005_contrasena_blob
"""
import hashlib
import os

import sqlalchemy as sa
from alembic import op

revision = "0005_contrasena_blob"
down_revision = "0004_parametros_recorrido"
branch_labels = None
depends_on = None

CLAVE_DEMO = "123456"


def _encriptar(clave: str) -> bytes:
    sal = os.urandom(16)
    return sal + hashlib.pbkdf2_hmac("sha256", clave.encode("utf-8"), sal, 600_000)


def upgrade():
    op.execute("ALTER TABLE usuario ADD COLUMN contrasena_encriptada BLOB NULL "
               "COMMENT 'Sal (16 bytes) + PBKDF2-SHA256 (32 bytes); nunca la contraseña' AFTER correo")
    con = op.get_bind()
    for (id_usuario,) in con.execute(sa.text("SELECT id_usuario FROM usuario")).all():
        con.execute(sa.text("UPDATE usuario SET contrasena_encriptada = :c WHERE id_usuario = :i"),
                    {"c": _encriptar(CLAVE_DEMO), "i": id_usuario})
    op.execute("ALTER TABLE usuario MODIFY contrasena_encriptada BLOB NOT NULL "
               "COMMENT 'Sal (16 bytes) + PBKDF2-SHA256 (32 bytes); nunca la contraseña'")
    op.execute("ALTER TABLE usuario DROP COLUMN contrasena_hash")


def downgrade():
    op.execute("ALTER TABLE usuario ADD COLUMN contrasena_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER correo")
    op.execute("ALTER TABLE usuario DROP COLUMN contrasena_encriptada")
