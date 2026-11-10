const assert = require('node:assert/strict');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { gzipSync } = require('node:zlib');
const express = require('express');
const nodemailer = require('nodemailer');
const proxyaddr = require('proxy-addr');
const JSZip = createRequire(require.resolve('mammoth'))('jszip');

// Exercise the real server and parsers without contacting Gemini or an SMTP server.
async function startServer(t) {
    let server;
    const prompts = [];
    const messages = [];
    const state = { aiText: '["Follow up"]', smtpFailure: false };
    const localExpress = Object.assign(() => {
        const app = express();
        app.set('env', 'test');
        app.listen = () => {
            server = require('node:http').createServer(app).listen(0, '127.0.0.1');
            return server;
        };
        return app;
    }, express);
    const sourcePath = path.join(__dirname, '..', 'server.js');
    const localRequire = createRequire(sourcePath);
    vm.runInNewContext(readFileSync(sourcePath, 'utf8'), {
        Buffer,
        Promise,
        console: { log() {}, error() {} },
        process: { env: { GEMINI_API_KEY: 'test-only', EMAIL_USER: 'sender@example.test' } },
        require(name) {
            if (name === 'dotenv') return { config() {} };
            if (name === 'express') return localExpress;
            if (name === '@google/generative-ai') return {
                GoogleGenerativeAI: class {
                    getGenerativeModel() {
                        return { async generateContent(prompt) {
                            prompts.push(prompt);
                            return { response: { text: () => state.aiText } };
                        } };
                    }
                }
            };
            if (name === 'nodemailer') return { createTransport() {
                return {
                    verify(callback) { callback(null, true); },
                    async sendMail(message) {
                        if (state.smtpFailure) throw new Error('Simulated SMTP failure');
                        messages.push(message);
                        return { messageId: 'test-message' };
                    }
                };
            } };
            return localRequire(name);
        }
    }, { filename: sourcePath });
    t.after(() => new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
    }));
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (route, body, headers = { 'Content-Type': 'application/json' }) =>
        fetch(base + route, { method: 'POST', headers, body: typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    const upload = (data, filename, field = 'feedbackFile') => {
        const form = new FormData();
        form.append(field, new Blob([data]), filename);
        return fetch(base + '/api/parse-email-ai', { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
    };
    return { post, upload, prompts, messages, state };
}

test('JSON, TXT and DOCX parsing preserve the frontend contract', async t => {
    const app = await startServer(t);
    const json = await app.post('/api/parse-email-ai', { emailText: 'JSON feedback' });
    assert.equal(json.status, 200);
    assert.deepEqual(await json.json(), { tasks: ['Follow up'] });
    assert.match(app.prompts.at(-1), /JSON feedback/);
    const txt = await app.upload('TXT feedback', 'feedback.txt');
    assert.equal(txt.status, 200);
    assert.match(app.prompts.at(-1), /TXT feedback/);
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX feedback</w:t></w:r></w:p></w:body></w:document>');
    const docx = await app.upload(await zip.generateAsync({ type: 'nodebuffer' }), 'feedback.docx');
    assert.equal(docx.status, 200);
    assert.match(app.prompts.at(-1), /DOCX feedback/);
});

test('invalid input and invalid AI output remain errors', async t => {
    const app = await startServer(t);
    assert.equal((await app.post('/api/parse-email-ai', {})).status, 500);
    assert.equal((await app.upload('unsupported', 'feedback.pdf')).status, 500);
    app.state.aiText = 'not an array';
    assert.equal((await app.post('/api/parse-email-ai', { emailText: 'feedback' })).status, 500);
});

test('upload limits and malformed multipart requests reject input without stopping the server', async t => {
    const app = await startServer(t);
    const unexpected = await app.upload('feedback', 'feedback.txt', 'wrongField');
    assert.equal(unexpected.status, 500);
    assert.match(await unexpected.text(), /Unexpected (?:file )?field/);
    const oversized = await app.upload(Buffer.alloc(10 * 1024 * 1024 + 1), 'large.txt');
    assert.equal(oversized.status, 500);
    assert.match(await oversized.text(), /File too large/);
    const malformed = await app.post('/api/parse-email-ai', '--test\r\nContent-Disposition: form-data; name="feedbackFile"; filename="a.txt"\r\n\r\ntruncated', { 'Content-Type': 'multipart/form-data; boundary=test' });
    assert.equal(malformed.status, 500);
    const healthy = await app.post('/api/parse-email-ai', { emailText: 'Still healthy' });
    assert.equal(healthy.status, 200);
});

test('compressed JSON works and corrupt compressed input does not stop the server', async t => {
    const app = await startServer(t);
    const compressed = gzipSync(JSON.stringify({ emailText: 'Compressed feedback' }));
    const headers = { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' };
    assert.equal((await app.post('/api/parse-email-ai', compressed, headers)).status, 200);
    const corrupt = await app.post('/api/parse-email-ai', Buffer.concat([compressed, Buffer.from('invalid trailing bytes')]), headers);
    assert.equal(corrupt.status, 400);
    assert.equal((await app.post('/api/parse-email-ai', { emailText: 'Still healthy' })).status, 200);
});

test('email summary preserves validation, message fields and SMTP failure handling', async t => {
    const app = await startServer(t);
    const route = '/api/send-summary';
    assert.equal((await app.post(route, { recipientEmail: 'user@example.test' })).status, 400);
    assert.equal((await app.post(route, { summaryText: 'Summary' })).status, 400);
    assert.equal((await app.post(route, { summaryText: 'Summary', recipientEmail: 'invalid' })).status, 400);
    const success = await app.post(route, { summaryText: 'Completed task', recipientEmail: 'user@example.test' });
    assert.equal(success.status, 200);
    assert.equal(app.messages.length, 1);
    assert.equal(app.messages[0].from, '"To-Do App" <sender@example.test>');
    assert.equal(app.messages[0].to, 'user@example.test');
    assert.equal(app.messages[0].subject, 'Your To-Do List Summary');
    assert.equal(app.messages[0].text, 'Completed task');
    app.state.smtpFailure = true;
    assert.equal((await app.post(route, { summaryText: 'Summary', recipientEmail: 'user@example.test' })).status, 500);
});

test('real Nodemailer composes the expected plain-text summary without sending', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const info = await transport.sendMail({ from: 'sender@example.test', to: 'user@example.test', subject: 'Your To-Do List Summary', text: 'Completed task' });
    assert.deepEqual(info.envelope.to, ['user@example.test']);
    assert.match(info.message.toString(), /Content-Type: text\/plain/);
    assert.match(info.message.toString(), /Completed task/);
});

// Published reproductions for GHSA-8c8m-p3m8-cjg8 and GHSA-m943-m63m-w62w.
test('Nodemailer never turns nested comments or group comments into recipients', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    for (const to of ['Victim (x(y) <evil@evil.com>) <v@victim.com>', 'G: (a; <evil@evil.com>) <v@victim.com>;']) {
        const info = await transport.sendMail({ from: 'sender@example.test', to, text: 'Private summary' });
        assert.deepEqual(info.envelope.to, ['v@victim.com']);
    }
});

// Published reproduction for GHSA-jqcg-44mw-7w3h; the app does not enable trust proxy.
test('IPv4 clients cannot match an unrelated IPv6 proxy trust subnet', () => {
    assert.equal(proxyaddr.compile('::ffff:10.0.0.0/8')('203.0.113.5'), false);
    assert.equal(proxyaddr.compile('::/1')('203.0.113.5'), false);
    assert.equal(proxyaddr.compile('10.0.0.0/8')('10.1.2.3'), true);
    assert.equal(proxyaddr.compile('::ffff:10.0.0.0/104')('10.1.2.3'), true);
});
