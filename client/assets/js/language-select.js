document.getElementById('languageForm').addEventListener('submit', function(e) {
    e.preventDefault(); // Formun varsayılan davranışını engelle
    
    const targetLanguage = document.getElementById('targetLanguage').value;
    
    if (!targetLanguage) {
      alert('Lütfen hedef dil seçin!');
      return;
    }
  
    // Seçilen dili URL parametresi olarak ekle
    window.location.href = `translation.html?targetLang=${targetLanguage}`;
  });