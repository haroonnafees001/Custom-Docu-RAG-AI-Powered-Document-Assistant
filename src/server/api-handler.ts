/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse } from 'http';
import {
  generateSingleEmbedding,
  generateBatchEmbeddings,
  generateRagAnswer,
} from './rag-service.ts';

async function readJsonBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body && typeof (req as any).body === 'object') {
    return (req as any).body;
  }

  return new Promise((resolve, reject) => {
    let body = '';
    const timer = setTimeout(() => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    }, 4000);

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) {
        clearTimeout(timer);
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => {
      clearTimeout(timer);
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    if (req.readableEnded) {
      clearTimeout(timer);
      resolve(body ? JSON.parse(body) : {});
    }
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export async function handleApiRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';

  if (!url.startsWith('/api/')) {
    return false;
  }

  try {
    if (url === '/api/status' && req.method === 'GET') {
      sendJson(res, 200, {
        status: 'online',
        model: 'gemma-4-26b-a4b-it',
        embeddingModel: 'gemini-embedding-001',
        timestamp: new Date().toISOString(),
      });
      return true;
    }

    if (url === '/api/embed' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { text } = body;
      if (!text || typeof text !== 'string') {
        sendJson(res, 400, { error: 'Missing "text" string in request body' });
        return true;
      }
      const embedding = await generateSingleEmbedding(text);
      sendJson(res, 200, { embedding });
      return true;
    }

    if (url === '/api/embed-batch' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { texts } = body;
      if (!Array.isArray(texts)) {
        sendJson(res, 400, { error: 'Missing "texts" array in request body' });
        return true;
      }
      const embeddings = await generateBatchEmbeddings(texts);
      sendJson(res, 200, { embeddings });
      return true;
    }

    if (url === '/api/chat' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { query, history, systemInstruction, contextChunks, temperature } = body;
      if (!query || typeof query !== 'string') {
        sendJson(res, 400, { error: 'Missing "query" in request body' });
        return true;
      }

      const result = await generateRagAnswer({
        query,
        history,
        systemInstruction,
        contextChunks: contextChunks || [],
        temperature: typeof temperature === 'number' ? temperature : 0.3,
      });

      sendJson(res, 200, result);
      return true;
    }

    sendJson(res, 404, { error: `Endpoint not found: ${url}` });
    return true;
  } catch (error: any) {
    console.error('API Error in handleApiRoute:', error);
    sendJson(res, 500, {
      error: error.message || 'Internal server error while executing RAG operation',
    });
    return true;
  }
}
