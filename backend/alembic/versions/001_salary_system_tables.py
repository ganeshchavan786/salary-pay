"""salary system tables

Revision ID: 001_salary_system
Revises: 
Create Date: 2026-04-22

"""
from alembic import op
import sqlalchemy as sa

revision = '001_salary_system'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # payroll_periods
    op.create_table(
        'payroll_periods',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('period_name', sa.String(100), nullable=False),
        sa.Column('period_type', sa.String(20), default='MONTHLY'),
        sa.Column('start_date', sa.DateTime, nullable=False),
        sa.Column('end_date', sa.DateTime, nullable=False),
        sa.Column('state', sa.String(20), nullable=False, default='DRAFT'),
        sa.Column('total_employees', sa.Integer, default=0),
        sa.Column('processed_employees', sa.Integer, default=0),
        sa.Column('total_gross_amount', sa.Numeric(15, 2), default=0),
        sa.Column('total_net_amount', sa.Numeric(15, 2), default=0),
        sa.Column('total_deductions', sa.Numeric(15, 2), default=0),
        sa.Column('processing_started_at', sa.DateTime, nullable=True),
        sa.Column('processing_completed_at', sa.DateTime, nullable=True),
        sa.Column('locked_at', sa.DateTime, nullable=True),
        sa.Column('locked_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now()),
        sa.UniqueConstraint('start_date', 'end_date', name='uq_payroll_period_dates'),
    )

    # salary_configs
    op.create_table(
        'salary_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('employee_id', sa.String(36), sa.ForeignKey('employees.id'), nullable=False),
        sa.Column('effective_date', sa.DateTime, nullable=False),
        sa.Column('basic_salary', sa.Numeric(12, 2), nullable=False),
        sa.Column('hra_percentage', sa.Numeric(5, 2), default=50.00),
        sa.Column('special_allowance', sa.Numeric(12, 2), default=0),
        sa.Column('travel_allowance', sa.Numeric(12, 2), default=0),
        sa.Column('medical_allowance', sa.Numeric(12, 2), default=0),
        sa.Column('other_allowances', sa.JSON, default=dict),
        sa.Column('pf_applicable', sa.Boolean, default=True),
        sa.Column('esi_applicable', sa.Boolean, default=True),
        sa.Column('pt_applicable', sa.Boolean, default=True),
        sa.Column('tax_regime', sa.String(10), default='new'),
        sa.Column('cost_center_allocations', sa.JSON, default=list),
        sa.Column('status', sa.String(20), default='active'),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now()),
    )
    op.create_index('idx_salary_configs_employee', 'salary_configs', ['employee_id'])

    # salary_calculations
    op.create_table(
        'salary_calculations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('employee_id', sa.String(36), sa.ForeignKey('employees.id'), nullable=False),
        sa.Column('period_id', sa.String(36), sa.ForeignKey('payroll_periods.id'), nullable=False),
        sa.Column('calculation_version', sa.Integer, default=1),
        sa.Column('total_days', sa.Integer, default=0),
        sa.Column('working_days', sa.Integer, default=0),
        sa.Column('present_days', sa.Integer, default=0),
        sa.Column('absent_days', sa.Integer, default=0),
        sa.Column('leave_days', sa.Integer, default=0),
        sa.Column('overtime_hours', sa.Numeric(5, 2), default=0),
        sa.Column('basic_salary', sa.Numeric(12, 2), default=0),
        sa.Column('hra', sa.Numeric(12, 2), default=0),
        sa.Column('special_allowance', sa.Numeric(12, 2), default=0),
        sa.Column('travel_allowance', sa.Numeric(12, 2), default=0),
        sa.Column('medical_allowance', sa.Numeric(12, 2), default=0),
        sa.Column('overtime_amount', sa.Numeric(12, 2), default=0),
        sa.Column('arrears_amount', sa.Numeric(12, 2), default=0),
        sa.Column('other_earnings', sa.Numeric(12, 2), default=0),
        sa.Column('gross_salary', sa.Numeric(12, 2), default=0),
        sa.Column('pf_employee', sa.Numeric(12, 2), default=0),
        sa.Column('pf_employer', sa.Numeric(12, 2), default=0),
        sa.Column('esi_employee', sa.Numeric(12, 2), default=0),
        sa.Column('esi_employer', sa.Numeric(12, 2), default=0),
        sa.Column('professional_tax', sa.Numeric(12, 2), default=0),
        sa.Column('income_tax', sa.Numeric(12, 2), default=0),
        sa.Column('loan_deductions', sa.Numeric(12, 2), default=0),
        sa.Column('advance_deductions', sa.Numeric(12, 2), default=0),
        sa.Column('fine_deductions', sa.Numeric(12, 2), default=0),
        sa.Column('lop_deduction', sa.Numeric(12, 2), default=0),
        sa.Column('other_deductions', sa.Numeric(12, 2), default=0),
        sa.Column('total_deductions', sa.Numeric(12, 2), default=0),
        sa.Column('net_salary', sa.Numeric(12, 2), default=0),
        sa.Column('status', sa.String(20), default='draft'),
        sa.Column('calculation_errors', sa.JSON, default=list),
        sa.Column('calculation_details', sa.JSON, default=dict),
        sa.Column('calculated_at', sa.DateTime, default=sa.func.now()),
        sa.Column('calculated_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime, nullable=True),
        sa.Column('approved_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.UniqueConstraint('employee_id', 'period_id', 'calculation_version', name='uq_salary_calc_emp_period_ver'),
    )
    op.create_index('idx_salary_calc_period_employee', 'salary_calculations', ['period_id', 'employee_id'])
    op.create_index('idx_salary_calc_status', 'salary_calculations', ['status', 'period_id'])

    # deductions
    op.create_table(
        'deductions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('employee_id', sa.String(36), sa.ForeignKey('employees.id'), nullable=False),
        sa.Column('deduction_type', sa.String(20), nullable=False),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('emi_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('recovered', sa.Numeric(12, 2), default=0),
        sa.Column('remaining', sa.Numeric(12, 2), nullable=False),
        sa.Column('recovery_mode', sa.String(20), default='installments'),
        sa.Column('installments', sa.String(10), nullable=True),
        sa.Column('start_period', sa.DateTime, nullable=True),
        sa.Column('end_period', sa.DateTime, nullable=True),
        sa.Column('status', sa.String(20), default='ACTIVE'),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('approved_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime, nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now()),
    )
    op.create_index('idx_deductions_employee', 'deductions', ['employee_id', 'status'])

    # tax_declarations
    op.create_table(
        'tax_declarations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('employee_id', sa.String(36), sa.ForeignKey('employees.id'), nullable=False),
        sa.Column('financial_year', sa.String(10), nullable=False),
        sa.Column('tax_regime', sa.String(10), default='new'),
        sa.Column('section_80c', sa.Numeric(12, 2), default=0),
        sa.Column('section_80d', sa.Numeric(12, 2), default=0),
        sa.Column('hra_exemption', sa.Numeric(12, 2), default=0),
        sa.Column('other_exemptions', sa.JSON, default=dict),
        sa.Column('total_exemptions', sa.Numeric(12, 2), default=0),
        sa.Column('declaration_date', sa.DateTime, default=sa.func.now()),
        sa.Column('status', sa.String(20), default='submitted'),
        sa.Column('approved_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now()),
        sa.UniqueConstraint('employee_id', 'financial_year', name='uq_tax_decl_emp_fy'),
    )

    # salary_formulas
    op.create_table(
        'salary_formulas',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('formula_expression', sa.Text, nullable=False),
        sa.Column('input_variables', sa.JSON, default=list),
        sa.Column('output_variable', sa.String(100), nullable=False),
        sa.Column('dependencies', sa.JSON, default=list),
        sa.Column('formula_type', sa.String(50), nullable=False),
        sa.Column('effective_date', sa.DateTime, nullable=False),
        sa.Column('expiry_date', sa.DateTime, nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now()),
    )

    # compliance_reports
    op.create_table(
        'compliance_reports',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('report_type', sa.String(50), nullable=False),
        sa.Column('period_id', sa.String(36), sa.ForeignKey('payroll_periods.id'), nullable=True),
        sa.Column('financial_year', sa.String(10), nullable=True),
        sa.Column('quarter', sa.String(5), nullable=True),
        sa.Column('report_data', sa.JSON, default=dict),
        sa.Column('file_path', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), default='generated'),
        sa.Column('generated_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('generated_at', sa.DateTime, default=sa.func.now()),
    )

    # approval_workflows
    op.create_table(
        'approval_workflows',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('workflow_name', sa.String(100), nullable=False),
        sa.Column('workflow_type', sa.String(50), nullable=False),
        sa.Column('steps', sa.JSON, nullable=False, default=list),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
    )

    # approval_requests
    op.create_table(
        'approval_requests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('workflow_id', sa.String(36), sa.ForeignKey('approval_workflows.id'), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.String(36), nullable=False),
        sa.Column('current_step', sa.Integer, default=1),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('requested_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('requested_at', sa.DateTime, default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime, nullable=True),
    )

    # approval_actions
    op.create_table(
        'approval_actions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('request_id', sa.String(36), sa.ForeignKey('approval_requests.id'), nullable=False),
        sa.Column('step_number', sa.Integer, nullable=False),
        sa.Column('approver_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('comments', sa.Text, nullable=True),
        sa.Column('action_date', sa.DateTime, default=sa.func.now()),
    )

    # salary_audit_logs
    op.create_table(
        'salary_audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.String(36), nullable=False),
        sa.Column('operation', sa.String(50), nullable=False),
        sa.Column('old_values', sa.JSON, nullable=True),
        sa.Column('new_values', sa.JSON, nullable=True),
        sa.Column('changed_fields', sa.JSON, nullable=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('session_id', sa.String(100), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('record_hash', sa.String(64), nullable=True),
        sa.Column('previous_hash', sa.String(64), nullable=True),
        sa.Column('timestamp', sa.DateTime, default=sa.func.now(), index=True),
    )
    op.create_index('idx_salary_audit_entity', 'salary_audit_logs', ['entity_type', 'entity_id'])
    op.create_index('idx_salary_audit_user', 'salary_audit_logs', ['user_id'])

    # arrears
    op.create_table(
        'arrears',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('employee_id', sa.String(36), sa.ForeignKey('employees.id'), nullable=False),
        sa.Column('period_id', sa.String(36), sa.ForeignKey('payroll_periods.id'), nullable=False),
        sa.Column('effective_from', sa.DateTime, nullable=False),
        sa.Column('old_basic', sa.Numeric(12, 2), nullable=False),
        sa.Column('new_basic', sa.Numeric(12, 2), nullable=False),
        sa.Column('arrear_months', sa.Integer, default=1),
        sa.Column('arrear_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('tax_impact', sa.Numeric(12, 2), default=0),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('arrears')
    op.drop_table('salary_audit_logs')
    op.drop_table('approval_actions')
    op.drop_table('approval_requests')
    op.drop_table('approval_workflows')
    op.drop_table('compliance_reports')
    op.drop_table('salary_formulas')
    op.drop_table('tax_declarations')
    op.drop_table('deductions')
    op.drop_table('salary_calculations')
    op.drop_table('salary_configs')
    op.drop_table('payroll_periods')
