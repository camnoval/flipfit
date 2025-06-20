# 👕 FlipFit

Estimate the resale value of thrifted clothing using AI and online resale listings.

## 🧠 What It Does

1. Takes an image of clothing.
2. Uses BLIP (image captioning AI) to describe the item.
3. Searches eBay for similar items.
4. Estimates the average resale value from prices.

## 🛠 Installation

```bash
git clone https://github.com/camnoval/flipfit.git
cd flipfit
pip install -r requirements.txt
```

## 🚀 Usage

Replace `test_clothing.jpg` with your image and run:

```bash
python clothing_appraiser.py
```

## 📷 Example Output

```
🧠 Identifying clothing...
📝 Caption: a red leather jacket
🔍 Searching eBay...
💰 Estimated resale value: $52.17 based on 8 listings
```

---

**Disclaimer**: This is a proof-of-concept. Use it as a starting point for your own app, GUI, or resale tool.
