import net from 'net';

const hosts = [
  { host: 'aws-1-us-east-1.pooler.supabase.com', port: 5432, label: 'Direct Port 5432 (New Pooler Host)' },
  { host: 'aws-1-us-east-1.pooler.supabase.com', port: 6543, label: 'Pooler Port 6543 (New Pooler Host)' }
];

console.log('--- DIAGNÓSTICO DE RED HACIA SUPABASE ---');

for (const item of hosts) {
  const socket = new net.Socket();
  const start = Date.now();
  
  socket.setTimeout(6000);
  
  socket.connect(item.port, item.host, () => {
    console.log(`\x1b[32m✅ CONEXIÓN EXITOSA: ${item.label} es alcanzable en ${Date.now() - start}ms\x1b[0m`);
    socket.destroy();
  });
  
  socket.on('error', (err) => {
    console.log(`\x1b[31m❌ ERROR DE CONEXIÓN: ${item.label} falló. Detalle: ${err.message}\x1b[0m`);
    socket.destroy();
  });
  
  socket.on('timeout', () => {
    console.log(`\x1b[33m⏳ TIEMPO DE ESPERA AGOTADO: ${item.label} no respondió tras 6 segundos\x1b[0m`);
    socket.destroy();
  });
}
