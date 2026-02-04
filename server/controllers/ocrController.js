const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

exports.parsePartsFromImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Зображення не знайдено' });
    }

    const imagePath = req.file.path;
    
    // Initialize Tesseract worker
    const worker = await createWorker('ukr+eng');
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();

    // Clean up uploaded file
    fs.unlink(imagePath, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    // Parse the text
    // The parsing logic needs to be robust to handle the format described
    const parts = parseOcrText(text);

    res.json(parts);
  } catch (err) {
    console.error('OCR Error:', err);
    res.status(500).json({ message: 'Помилка розпізнавання тексту', error: err.message });
  }
};

// Parser logic based on the user provided example structure and typical OCR output
// We look for blocks of text that resemble a product entry
function parseOcrText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const parts = [];
  
  let currentPart = null;
  
  // Heuristic:
  // 1. Look for Manufacturer + Code (often uppercase, alphanum)
  // 2. Look for "Ціна" or price
  // 3. Look for "Кількість" or quantity
  
  // Regex patterns
  const priceRegex = /(?:Ціна|Цена|Price).*?(\d+[\d\s]*)/i;
  const qtyRegex = /(?:Кількість|Количество|Qty).*?(\d+)/i;
  const sumRegex = /(?:Сума|Сумма|Sum).*?(\d+[\d\s]*)/i;
  // A heuristic for the main header line of a part: e.g., "VICTOR REINZ 40-76149-00"
  // It usually starts with uppercase letters.
  
  // Since OCR output can be messy (lines interleaved or grouped), we try to group by proximity or pattern.
  // Given the layout described (rows), we might see repeated patterns.
  
  // Let's try a simple state machine or block parser.
  
  // For this specific layout, it seems each "block" ends with "X удалить" or a Sum.
  
  // Let's try to iterate and build objects.
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line is likely a start of a new item (Name/Code)
    // If we found a price/sum in the previous item, this might be a new item.
    // Or if the line looks like "BRAND CODE"
    
    // However, Tesseract might just dump all text.
    // Let's look for the specific markers "Ціна (грн):" which splits items well.
    
    if (priceRegex.test(line)) {
        // We found a price line. The lines BEFORE this (until the previous item end) describe the product.
        const priceMatch = line.match(priceRegex);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/\s/g, '')) : 0;
        
        // Look ahead for Quantity and Sum
        let qty = 1;
        let j = i + 1;
        while (j < lines.length && j < i + 5) { // Look a few lines ahead
            const l = lines[j];
            const qtyMatch = l.match(qtyRegex);
            if (qtyMatch) {
                qty = parseInt(qtyMatch[1], 10);
                break;
            }
            j++;
        }
        
        // The name/code is likely in the lines preceding the price line.
        // We need to backtrack to find where this item started.
        // The item likely started after the previous "X удалить" or "Sum" or similar marker.
        
        // This is tricky without strict structure.
        // Let's assume the 2-3 lines before "Termin postavki" or "Cina" are the name.
        
        // Let's try to find "Термін поставки" before the price
        let nameLines = [];
        let k = i - 1;
        let foundTermin = false;
        
        // Backtrack to find "Termin postavki"
        while (k >= 0) {
            if (lines[k].includes('Термін поставки') || lines[k].includes('Термин')) {
                foundTermin = true;
                // The lines BEFORE "Termin..." are the name
                let m = k - 1;
                while (m >= 0) {
                    // Stop if we hit a "Sum" or "X delete" or another "Price" line from previous item
                    if (lines[m].includes('Сума') || lines[m].includes('удалить') || lines[m].includes('X') || lines[m].match(priceRegex)) {
                        break;
                    }
                    nameLines.unshift(lines[m]);
                    m--;
                }
                break;
            }
            k--;
        }
        
        // If we didn't find "Termin", maybe just take 1-2 lines before price?
        if (!foundTermin) {
             let m = i - 1;
             let count = 0;
             while (m >= 0 && count < 2) {
                if (lines[m].includes('Сума') || lines[m].includes('удалить')) break;
                nameLines.unshift(lines[m]);
                m--;
                count++;
             }
        }
        
        const fullTitle = nameLines.join(' ').trim();
        // Try to split Code and Name. Usually "BRAND CODE Name..."
        // e.g. "VICTOR REINZ 40-76149-00 Прокладка, термостат"
        // Let's just use the full string as name for now, or try to split.
        
        // Basic parsing of title
        let brand = '';
        let partNumber = '';
        let name = fullTitle;
        
        const partsSplit = fullTitle.split(' ');
        if (partsSplit.length >= 2) {
            // Heuristic: First word Brand, second Code? Or first 2 words Brand?
            // "VICTOR REINZ" is 2 words.
            // Let's just store the full text in 'name' and let user edit.
        }

        if (name && price) {
            parts.push({
                name: name,
                price: price,
                quantity: qty,
                part_number: '', // Hard to extract reliably without more logic
                purchased_by: 'owner' // Default
            });
        }
    }
  }
  
  return parts;
}
