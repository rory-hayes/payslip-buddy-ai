insert into public.kb (region, category, title, note, link, sort_order)
values
  ('UK', 'checklist', 'Verify tax code', 'Ensure PAYE tax code matches HMRC notice.', 'https://www.gov.uk/check-income-tax-current-year', 1),
  ('UK', 'checklist', 'Review pension deductions', 'Confirm pension contributions match plan documents.', 'https://www.thepensionsregulator.gov.uk/', 2),
  ('IE', 'checklist', 'Confirm PRSI class', 'Validate PRSI contribution class for the pay period.', 'https://www.gov.ie/en/publication/1d74d-pay-related-social-insurance-prsi/', 1),
  ('IE', 'checklist', 'Compare USC bands', 'Review Universal Social Charge thresholds for accuracy.', 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/usc/index.aspx', 2)
on conflict do nothing;
