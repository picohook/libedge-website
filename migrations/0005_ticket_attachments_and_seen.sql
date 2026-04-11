-- Ticket reply attachments
ALTER TABLE ticket_replies ADD COLUMN attachment_url TEXT;

-- Track when user last viewed each ticket (for unread indicator)
ALTER TABLE support_tickets ADD COLUMN user_last_seen DATETIME;
ALTER TABLE support_tickets ADD COLUMN admin_last_seen DATETIME;
