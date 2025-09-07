import {
  GoogleAuth
} from '@google-cloud/local-auth';
import {
  Translate
} from '@google-cloud/translate/v2';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const text = url.searchParams.get("text");
  const target = url.searchParams.get("target");

  if (!text || !target) {
    return new Response(JSON.stringify({
      error: "Text or target param missing"
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }

  const project_id = SA_PROJECT_ID;
  const sa_email = SA_CLIENT_EMAIL;
  const sa_private_key = SA_PRIVATE_KEY.replace(/\\n/g, '\n');

  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: sa_email,
        private_key: sa_private_key
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const translate = new Translate({
      auth,
      projectId: project_id
    });

    const [translation] = await translate.translate(text, target);
    return new Response(JSON.stringify({
      data: {
        translations: [{
          translatedText: translation
        }]
      }
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error("Translation API Error:", error);
    return new Response(JSON.stringify({
      error: "Translation failed"
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}