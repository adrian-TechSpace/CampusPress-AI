alter table public.subscriptions
  alter column provider set default 'flutterwave';

alter table public.payments
  alter column provider set default 'flutterwave';
