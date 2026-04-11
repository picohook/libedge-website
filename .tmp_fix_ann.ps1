$path = Resolve-Path 'announcements.html'
$text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$replacements = @(
  @('ÃœrÃ¼nler','Ürünler'),
  @('BroÅŸÃ¼rler','Broşürler'),
  @('Ä°letiÅŸim','İletişim'),
  @('En gÃ¼ncel Ã¼rÃ¼n haberleri, etkinlikler, kampanyalar ve sektÃ¶r duyurularÄ±ndan haberdar olun.','En güncel ürün haberleri, etkinlikler, kampanyalar ve sektör duyurularından haberdar olun.'),
  @('Ã–ncelik','Öncelik'),
  @('BaÅŸlÄ±k (A-Z)','Başlık (A-Z)'),
  @('TÃ¼mÃ¼','Tümü'),
  @('Yeni ÃœrÃ¼n','Yeni Ürün'),
  @('GÃ¼ncelleme','Güncelleme'),
  @('BakÄ±m','Bakım'),
  @('DuyurularÄ± KaÃ§Ä±rmayÄ±n','Duyuruları Kaçırmayın'),
  @('En gÃ¼ncel duyurular, kampanyalar ve etkinliklerden anÄ±nda haberdar olmak iÃ§in e-bÃ¼ltenimize abone olun.','En güncel duyurular, kampanyalar ve etkinliklerden anında haberdar olmak için e-bültenimize abone olun.'),
  @('PaylaÅŸ','Paylaş')
)
foreach ($pair in $replacements) { $text = $text.Replace($pair[0], $pair[1]) }
[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))