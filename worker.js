export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON body', { status: 400 });
    }

    // 调试日志
    console.log('Request body:', JSON.stringify(body, null, 2));

    // 模型名映射：claude-haiku-5-5 → anthropic/claude-haiku-5.5
    if (body.model && !body.model.startsWith('anthropic/')) {
      body.model = 'anthropic/' + body.model.replace(/5-5/g, '5.5');
    }

    // 处理 messages：过滤无效 role，把 system 消息提取到 system 参数
    if (body.messages && Array.isArray(body.messages)) {
      const validMessages = [];
      let systemPrompt = body.system || '';

      for (const msg of body.messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          validMessages.push(msg);
        } else if (msg.role === 'system') {
          const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);
          systemPrompt = systemPrompt
            ? systemPrompt + '\n\n' + content
            : content;
        }
      }

      body.messages = validMessages;
      if (systemPrompt) {
        body.system = systemPrompt;
      }
    }

    const targetUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/v1/messages`;

    const headers = {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const anthropicVersion = request.headers.get('anthropic-version');
    if (anthropicVersion) {
      headers['anthropic-version'] = anthropicVersion;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    console.log('Response status:', response.status);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  },
};

