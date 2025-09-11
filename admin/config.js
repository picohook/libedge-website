CMS.init({
  config: {
    backend: {
      name: 'github',
      repo: 'picohook/libedge-website',
      branch: 'main'
    },
    media_folder: "assets/images/uploads",
    public_folder: "/assets/images/uploads",
    collections: [
      {
        name: "announcements",
        label: "Duyurular",
        label_singular: "Duyuru",
        description: "Web sitesindeki duyuruları buradan ekleyebilir veya düzenleyebilirsiniz.",
        files: [
          {
            file: "duyurular.json",
            label: "Tüm Duyurular",
            name: "all_announcements",
            fields: [
              { label: "Duyuru Listesi", name: "items", widget: "list", fields: [
                  { label: "Başlık", name: "title", widget: "string" },
                  { label: "Tarih", name: "date", widget: "datetime", format: "YYYY-MM-DD" },
                  { label: "Kategori", name: "category", widget: "select", options: ["urgent", "new-product", "event", "maintenance", "general"] },
                  { label: "Özet (Kısa Açıklama)", name: "summary", widget: "text" },
                  { label: "Tam İçerik (Detaylı Açıklama)", name: "full_content", widget: "markdown" }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
});