insert into public.kb (region, category, title, note, link, sort_order)
values
  ('UK', 'checklist', 'Verify tax code', 'Ensure PAYE tax code matches HMRC notice.', 'https://www.gov.uk/check-income-tax-current-year', 1),
  ('UK', 'checklist', 'Review pension deductions', 'Confirm pension contributions match plan documents.', 'https://www.thepensionsregulator.gov.uk/', 2),
  ('UK', 'checklist', 'Student loan thresholds', 'Compare repayments against current HMRC thresholds.', 'https://www.gov.uk/repaying-your-student-loan', 3),
  ('IE', 'checklist', 'Confirm PRSI class', 'Validate PRSI contribution class for the pay period.', 'https://www.gov.ie/en/publication/1d74d-pay-related-social-insurance-prsi/', 1),
  ('IE', 'checklist', 'Compare USC bands', 'Review Universal Social Charge thresholds for accuracy.', 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/usc/index.aspx', 2),
  ('IE', 'checklist', 'Pension tax relief', 'Check that pension relief is applied according to age band.', 'https://www.citizensinformation.ie/en/money-and-tax/tax/pensions-tax/', 3),
  ('Shared', 'guide', 'Rent tax credit', 'Irish renters may qualify for annual rent credit—confirm receipts are captured.', 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/rent-credit/index.aspx', 4)
on conflict do nothing;
