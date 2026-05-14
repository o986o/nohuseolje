from sqlalchemy import Column, String, Boolean, SmallInteger, BigInteger, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMPTZ
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100))
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())

    profile = relationship("UserProfile", back_populates="user", uselist=False)
    scenarios = relationship("Scenario", back_populates="user")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    birth_year = Column(SmallInteger, nullable=False)
    birth_month = Column(SmallInteger)
    gender = Column(String(10))
    retirement_age = Column(SmallInteger, default=65)
    target_death_age = Column(SmallInteger, default=100)

    residence_type = Column(String(20), default="regional")
    has_spouse = Column(Boolean, default=False)
    spouse_birth_year = Column(SmallInteger)
    spouse_gender = Column(String(10))
    spouse_income_monthly = Column(BigInteger, default=0)
    dependents_count = Column(SmallInteger, default=0)

    current_age = Column(SmallInteger)
    employment_status = Column(String(20), default="employed")
    monthly_salary = Column(BigInteger, default=0)
    business_income_annual = Column(BigInteger, default=0)
    other_income_annual = Column(BigInteger, default=0)

    total_financial_assets = Column(BigInteger, default=0)
    domestic_stock = Column(BigInteger, default=0)
    us_stock = Column(BigInteger, default=0)
    other_overseas_stock = Column(BigInteger, default=0)
    bonds = Column(BigInteger, default=0)
    cash_deposits = Column(BigInteger, default=0)
    real_estate_value = Column(BigInteger, default=0)
    real_estate_loan = Column(BigInteger, default=0)
    other_assets = Column(BigInteger, default=0)

    national_pension_monthly = Column(BigInteger, default=0)
    pension_savings_balance = Column(BigInteger, default=0)
    irp_balance = Column(BigInteger, default=0)
    isa_balance = Column(BigInteger, default=0)
    company_pension_balance = Column(BigInteger, default=0)
    pension_start_age = Column(SmallInteger, default=65)

    monthly_living_expense = Column(BigInteger, default=0)
    monthly_medical_expense = Column(BigInteger, default=0)
    monthly_housing_expense = Column(BigInteger, default=0)
    target_monthly_expense = Column(BigInteger, default=0)
    risk_tolerance = Column(String(20), default="moderate")

    created_at = Column(TIMESTAMPTZ, server_default=func.now())
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="profile")


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String(200), nullable=False)
    description = Column(Text)
    is_default = Column(Boolean, default=False)
    profile_snapshot = Column(JSONB, nullable=False)
    params = Column(JSONB, default={})
    policy_version = Column(String(20), default="2026.1.0")
    created_at = Column(TIMESTAMPTZ, server_default=func.now())
    updated_at = Column(TIMESTAMPTZ, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="scenarios")
