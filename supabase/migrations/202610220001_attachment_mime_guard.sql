-- A validação do React pode ser contornada por chamadas diretas ao Storage.
-- Reaplica no bucket a mesma lista de formatos permitidos pela aplicação.
begin;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/avif',
  'application/pdf', 'text/plain'
]::text[]
where id = 'task-attachments';

commit;
