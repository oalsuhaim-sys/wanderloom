-- Activity / entry tickets (theme parks, museums, circus, etc.)
alter table itineraries add column if not exists ticket_details jsonb default '[]'::jsonb;

comment on column itineraries.ticket_details is 'VIP activity tickets: title, date, ticket_number';
