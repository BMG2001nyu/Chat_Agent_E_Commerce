'use client';

export default function ProductCard({ product }) {
  const stars = '★'.repeat(Math.round(product.rating)) + '☆'.repeat(5 - Math.round(product.rating));

  return (
    <div className="product-card">
      <div className="product-card-header">
        <span className="part-number">Part #{product.part_number}</span>
        <span className={`stock-badge ${product.in_stock ? 'in-stock' : 'out-of-stock'}`}>
          {product.in_stock ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>

      <div className="product-card-body">
        <h4 className="product-name">{product.name}</h4>
        <p className="product-description">{product.description}</p>

        <div className="product-meta">
          <span className="product-rating" title={`${product.rating} out of 5`}>
            {stars} <span className="review-count">({product.review_count.toLocaleString()})</span>
          </span>
          <span className="product-difficulty">🔧 {product.difficulty}</span>
          <span className="product-time">⏱ {product.repair_time}</span>
        </div>

        <div className="product-brands">
          Fits: {product.compatible_brands.join(', ')}
        </div>
      </div>

      <div className="product-card-footer">
        <span className="product-price">${product.price.toFixed(2)}</span>
        <div className="product-actions">
          <button
            className="btn-secondary"
            onClick={() => window.open(`https://www.partselect.com/PS${product.part_number.replace('PS', '')}-Part.htm`, '_blank')}
          >
            View Details
          </button>
          <button className="btn-primary">Add to Cart</button>
        </div>
      </div>
    </div>
  );
}
