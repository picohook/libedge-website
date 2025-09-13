export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "https://libedge-website.pages.dev", // kendi domaininiz
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method === "POST") {
      try {
        const data = await request.json();
        const { formType, name, email, message } = data;

        let subject = "Form Gönderimi";
        let sheetPayload = {};

        // Form tipine göre ayrım
        if (formType === "trial") {
          subject = "Trial Access Request";
          sheetPayload = { form: "Trial", name, email, message };
        } else if (formType === "suggest") {
          subject = "Suggest a Product";
          sheetPayload = { form: "Suggest", name, email, message };
        } else if (formType === "contact") {
          subject = "Contact Form";
          sheetPayload = { 
            form: "Contact", 
            name, 
            email, 
            phone: data.phone || "", 
            subject: data.subject || "", 
            message 
          };
        }

        // 1. Mail gönder (Resend)
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "LibEdge <noreply@libedge.com>",
            to: ["info@libedge.com.tr", email],
            subject,
            html: `
              <h3>${subject}</h3>
              <p><b>Ad:</b> ${name}</p>
              <p><b>Email:</b> ${email}</p>
              ${formType === "contact" ? `<p><b>Telefon:</b> ${data.phone || "-"}</p>` : ""}
              ${formType === "contact" ? `<p><b>Konu:</b> ${data.subject || "-"}</p>` : ""}
              <p><b>Mesaj:</b> ${message || "-"}</p>
            `,
          }),
        });

        // 2. Google Sheets kaydı
        await fetch(env.GSHEET_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sheetPayload),
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "https://libedge-website.pages.dev",
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  },
};
