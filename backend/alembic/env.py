import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import all models so Alembic can detect schema changes
from app.database import Base
from app.models.user import User          # noqa: F401
from app.models.employee import Employee  # noqa: F401
from app.models.attendance import Attendance  # noqa: F401
# Salary system models
from app.models.payroll_period import PayrollPeriod  # noqa: F401
from app.models.salary_config import SalaryConfig  # noqa: F401
from app.models.salary_calculation import SalaryCalculation  # noqa: F401
from app.models.deduction import Deduction  # noqa: F401
from app.models.tax_declaration import TaxDeclaration  # noqa: F401
from app.models.salary_formula import SalaryFormula  # noqa: F401
from app.models.compliance_report import ComplianceReport  # noqa: F401
from app.models.approval import ApprovalWorkflow, ApprovalRequest, ApprovalAction  # noqa: F401
from app.models.salary_audit_log import SalaryAuditLog  # noqa: F401
from app.models.arrear import Arrear  # noqa: F401
from app.config import settings

# Alembic Config object
config = context.config

# Override sqlalchemy.url from app settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no DB connection needed)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations using async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
