-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  rating DECIMAL(3, 1) NOT NULL,
  store VARCHAR(100) NOT NULL,
  delivery_days INT NOT NULL,
  reliability INT NOT NULL,
  in_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comparisons table for history
CREATE TABLE IF NOT EXISTS comparisons (
  id SERIAL PRIMARY KEY,
  product_ids JSON NOT NULL,
  user_query TEXT,
  ai_response TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  favorite_products JSON DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample products
INSERT INTO products (name, category, price, rating, store, delivery_days, reliability, in_stock) VALUES
('UltraPhone 15', 'Smartphones', 899, 4.8, 'TechStore', 2, 98, true),
('UltraPhone 15', 'Smartphones', 879, 4.7, 'ElectroMart', 3, 96, true),
('UltraPhone 15', 'Smartphones', 920, 4.9, 'DigitalHub', 1, 99, true),
('ProTablet X', 'Tablets', 599, 4.6, 'TechStore', 3, 97, true),
('ProTablet X', 'Tablets', 579, 4.5, 'ShopHub', 4, 95, true),
('NoiseCancel Pro', 'Headphones', 299, 4.7, 'AudioWorld', 2, 96, true),
('NoiseCancel Pro', 'Headphones', 319, 4.8, 'SoundHub', 2, 98, true),
('SmartWatch Ultra', 'Wearables', 449, 4.6, 'WearTech', 3, 94, false),
('PowerBank 30K', 'Accessories', 89, 4.7, 'PowerSource', 2, 97, true),
('PowerBank 30K', 'Accessories', 79, 4.5, 'BudgetTech', 5, 92, true),
('Laptop Pro M4', 'Laptops', 1899, 4.9, 'ComputerWorld', 2, 99, true),
('Laptop Pro M4', 'Laptops', 1850, 4.8, 'TechDeals', 3, 97, true);
