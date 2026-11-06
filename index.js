console.log('Iniciando bot...');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Estado del grupo
let cantidad = 0;
let gastos = {};

// Inicializar cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea el QR con WhatsApp para iniciar sesión.');
});

client.on('ready', () => {
    console.log('Bot listo para usar en WhatsApp!');
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    console.log('Mensaje recibido:', msg.body, 'en chat', chat.name, 'isGroup:', chat.isGroup);
    if (!chat.isGroup) return; // Solo responder en grupos

    const textoOriginal = msg.body.trim();
    const texto = textoOriginal.toLowerCase();

    // Solo responder si el mensaje empieza con 'Gorda Zulma' (mayúsculas iniciales)
    if (!textoOriginal.startsWith('Gorda Zulma')) return;

    // Quitar el alias del bot para procesar los comandos
    let resto = textoOriginal.slice('Gorda Zulma'.length).trim();
    // Si el mensaje tiene varias líneas, procesar cada una
    let lineas = resto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    // Si la primera línea es un comando (ej: 'somos 5'), pero las siguientes no tienen el prefijo, procesarlas igual
    // Por compatibilidad, si la primera línea no es comando, agregarla
    if (lineas.length === 0 && resto.length > 0) {
        lineas = [resto];
    }
    // Procesar cada línea, permitiendo que las siguientes no tengan el prefijo
    for (const [i, lineaOriginal] of lineas.entries()) {
        // Si la línea empieza con 'Gorda Zulma', quitar el prefijo
        let lineaProc = lineaOriginal;
        if (lineaProc.toLowerCase().startsWith('gorda zulma')) {
            lineaProc = lineaProc.slice('gorda zulma'.length).trim();
        }
        const linea = lineaProc.toLowerCase();
        // Comando: somos N
        if (linea.startsWith('somos ')) {
            const partes = linea.split(' ');
            const n = parseInt(partes[1]);
            if (!isNaN(n) && n > 1) {
                cantidad = n;
                gastos = {};
                let respuesta = `Ok, son ${n} personas. Ahora envía los gastos con el formato: Gorda Zulma nombre gasto cantidad`;
                // Mostrar el monto por persona si ya hay gastos
                const total = Object.values(gastos).reduce((a, b) => a + b, 0);
                if (total > 0) {
                    const promedio = total / cantidad;
                    respuesta += `\n${n} personas = $${promedio.toFixed(2)} c/u`;
                }
                await msg.reply(respuesta);
            } else {
                await msg.reply('Por favor, indica un número válido. Ejemplo: Gorda Zulma somos 4');
            }
            continue;
        }
        // Comando: nombre gasto X
        if (linea.match(/^([a-záéíóúñü0-9]+) gasto [0-9]+(\.[0-9]+)?$/i)) {
            const partes = lineaOriginal.split(' ');
            const nombre = partes[0].toLowerCase();
            const monto = parseFloat(partes[2]);
            if (!isNaN(monto) && monto >= 0) {
                gastos[nombre] = (gastos[nombre] || 0) + monto;
                const total = Object.values(gastos).reduce((a, b) => a + b, 0);
                const promedio = cantidad > 0 ? total / cantidad : 0;
                let respuesta = `${nombre} gastó $${monto.toFixed(2)} (Total acumulado: $${gastos[nombre].toFixed(2)})`;
                if (cantidad > 0) {
                    respuesta += `\n\nTotal de gastos: $${total.toFixed(2)}\n${cantidad} personas = $${promedio.toFixed(2)} c/u`;
                }
                await msg.reply(respuesta);
            } else {
                await msg.reply('Formato incorrecto. Ejemplo: Gorda Zulma pepito gasto 100');
            }
            continue;
        }
        // Comando: dividir
        if (linea === 'dividir') {
            if (cantidad < 2 || Object.keys(gastos).length === 0) {
                await msg.reply('Primero indica cuántos son y los gastos de cada uno.');
                continue;
            }
            const total = Object.values(gastos).reduce((a, b) => a + b, 0);
            const promedio = total / cantidad;
            let respuesta = '';
            const nombres = Object.keys(gastos);
            for (const nombre of nombres) {
                respuesta += `🔹 ${capitalize(nombre)} gastó $${formatMoney(gastos[nombre])}\n`;
            }
            respuesta += `Total: $${formatMoney(total)} → Tocan $${formatMoney(promedio)} cada una\n\n`;
            // Calcular saldos
            let saldos = nombres.map(nombre => ({ nombre, saldo: Math.round((gastos[nombre] - promedio) * 100) / 100 }));
            let deudores = saldos.filter(s => s.saldo < 0).map(s => ({ ...s }));
            let acreedores = saldos.filter(s => s.saldo > 0).map(s => ({ ...s }));
            // Mostrar quién debe recibir
            for (const a of acreedores) {
                respuesta += `${capitalize(a.nombre)} debe recibir $${formatMoney(a.saldo)}\n`;
            }
            // Calcular transferencias
            let transferencias = [];
            for (let deudor of deudores) {
                for (let acreedor of acreedores) {
                    if (deudor.saldo === 0) break;
                    if (acreedor.saldo === 0) continue;
                    const monto = Math.min(-deudor.saldo, acreedor.saldo);
                    if (monto > 0) {
                        transferencias.push({
                            deudor: capitalize(deudor.nombre),
                            acreedor: capitalize(acreedor.nombre),
                            monto: monto
                        });
                        deudor.saldo += monto;
                        acreedor.saldo -= monto;
                    }
                }
            }
            // Mostrar transferencias
            for (const t of transferencias) {
                respuesta += `${t.deudor} debe transferirle a ${t.acreedor} $${formatMoney(t.monto)}\n`;
            }
            await msg.reply(respuesta.trim());
            continue;
        }
        // Comando: reset
        if (linea === 'reset') {
            cantidad = 0;
            gastos = {};
            await msg.reply('Datos reiniciados. Usa "Gorda Zulma somos N" para empezar de nuevo.');
            continue;
        }
        // Comando: ayuda
        if (linea === 'ayuda') {
            await msg.reply('Comandos disponibles:\n' +
                '- Gorda Zulma somos N\n' +
                '- Gorda Zulma NOMBRE gasto X\n' +
                '- Gorda Zulma dividir\n' +
                '- Gorda Zulma reset\n' +
                '- Gorda Zulma ayuda');
            continue;
        }
    }
});

client.initialize(); 

client.on('auth_failure', (msg) => {
    console.error('Fallo de autenticación:', msg);
});
client.on('disconnected', (reason) => {
    console.error('Cliente desconectado:', reason);
});
client.on('error', (err) => {
    console.error('Error en el cliente:', err);
}); 

// Helpers para formato
function formatMoney(num) {
    return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
} 