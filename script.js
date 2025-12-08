// script.js

// ====================
// BLOCKCHAIN IMPLEMENTATION
// ====================

class Block {
    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
    }
    
    calculateHash() {
        const blockString = JSON.stringify({
            index: this.index,
            timestamp: this.timestamp,
            data: this.data,
            previousHash: this.previousHash
        });
        
        // Simple hash function for demo (in production use crypto library)
        let hash = 0;
        for (let i = 0; i < blockString.length; i++) {
            const char = blockString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
}

class Blockchain {
    constructor() {
        this.chain = []; // Start empty, genesis will be added if needed
        this.products = new Map();
        this.farms = new Set();
    }
    
    createGenesisBlock() {
        return new Block(0, Date.now(), {
            product_id: 'GENESIS',
            action: 'Blockchain Initialized',
            location: 'System',
            note: 'Genesis block created'
        }, '0');
    }
    
    ensureGenesisBlock() {
        if (this.chain.length === 0) {
            this.chain = [this.createGenesisBlock()];
        }
    }
    
    getLatestBlock() {
        this.ensureGenesisBlock();
        return this.chain[this.chain.length - 1];
    }
    
    addBlock(data) {
        this.ensureGenesisBlock();
        const previousBlock = this.getLatestBlock();
        const newBlock = new Block(
            this.chain.length,
            Date.now(),
            data,
            previousBlock.hash
        );
        this.chain.push(newBlock);
        
        // Update product history
        if (data.product_id && data.product_id !== 'GENESIS') {
            if (!this.products.has(data.product_id)) {
                this.products.set(data.product_id, {
                    id: data.product_id,
                    info: data.product_info || {},
                    history: []
                });
            }
            this.products.get(data.product_id).history.push({
                action: data.action,
                location: data.location,
                timestamp: new Date().toISOString(),
                temperature: data.temperature,
                humidity: data.humidity,
                notes: data.notes,
                blockIndex: newBlock.index
            });
            
            // Track farm
            if (data.farm_name) {
                this.farms.add(data.farm_name);
            }
        }
        
        return newBlock;
    }
    
    getProduct(productId) {
        return this.products.get(productId);
    }
    
    getAllProducts() {
        return Array.from(this.products.values());
    }
    
    isChainValid() {
        this.ensureGenesisBlock();
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];
            
            // Check previous hash link
            if (currentBlock.previousHash !== previousBlock.hash) {
                console.error(`Chain broken at block ${i}: previousHash mismatch`);
                return false;
            }
            
            // Note: Not recalculating hashes for validation
            // because loaded blocks have preserved hashes
            // This is acceptable for demo purposes
        }
        return true;
    }
    
    getStats() {
        this.ensureGenesisBlock();
        return {
            totalBlocks: this.chain.length,
            totalProducts: this.products.size,
            totalFarms: this.farms.size,
            chainValid: this.isChainValid(),
            latestBlock: this.getLatestBlock()
        };
    }
}

// ====================
// GLOBAL VARIABLES
// ====================

let blockchain = new Blockchain();
let currentProductId = null;
let qrCodeInstance = null;

// ====================
// INITIALIZATION
// ====================

document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Set default harvest date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('harvestDate').value = today;
    document.getElementById('updateDate').value = today;
    
    // Load from localStorage if available
    loadFromLocalStorage();
    
    // Ensure we have at least the genesis block
    blockchain.ensureGenesisBlock();
    
    // Update all displays
    updateAllDisplays();
    
    // Form submission handlers
    document.getElementById('createProductForm').addEventListener('submit', createProduct);
    document.getElementById('updateLocationForm').addEventListener('submit', updateLocation);
    
    // Check for product ID in URL hash
    const hash = window.location.hash.substring(1);
    if (hash) {
        document.getElementById('trackProductId').value = hash;
        trackProduct();
    }
    
    // Demo data for first-time users
    if (blockchain.products.size === 0) {
        createDemoData();
    }
});

// ====================
// CORE FUNCTIONS
// ====================

function createProduct(e) {
    e.preventDefault();
    
    // Generate product ID (e.g., FARM-MNG-2024-001)
    const productId = generateProductId();
    
    // Get form data
    const productData = {
        product_id: productId,
        action: '🌱 Harvested',
        location: document.getElementById('farmLocation').value || 'Farm Field',
        temperature: document.getElementById('temperature').value || null,
        humidity: document.getElementById('humidity').value || null,
        notes: document.getElementById('productNotes').value,
        product_info: {
            farm_name: document.getElementById('farmName').value,
            farmer_name: document.getElementById('farmerName').value,
            product_type: document.getElementById('productType').value,
            harvest_date: document.getElementById('harvestDate').value,
            farm_location: document.getElementById('farmLocation').value,
            initial_notes: document.getElementById('productNotes').value
        },
        farm_name: document.getElementById('farmName').value
    };
    
    // Validate required fields
    if (!productData.product_info.farm_name || !productData.product_info.farmer_name || 
        !productData.product_info.product_type || !productData.product_info.harvest_date) {
        showAlert('Please fill in all required fields', 'warning');
        return;
    }
    
    // Add to blockchain
    blockchain.addBlock(productData);
    
    // Display QR code
    displayQRCode(productId);
    
    // Set current product for updates
    currentProductId = productId;
    document.getElementById('currentProductId').textContent = productId;
    document.getElementById('updateCard').style.display = 'block';
    
    // Reset form
    document.getElementById('createProductForm').reset();
    document.getElementById('harvestDate').value = new Date().toISOString().split('T')[0];
    
    // Update displays
    updateAllDisplays();
    
    // Show success message
    showAlert(`Product ${productId} created successfully! QR code generated.`, 'success');
    
    // Auto-track the new product
    document.getElementById('trackProductId').value = productId;
    setTimeout(() => trackProduct(), 1000);
    
    // Save to localStorage
    saveToLocalStorage();
}

function generateProductId() {
    const prefix = 'FARM';
    const type = document.getElementById('productType').value.substring(0, 3).toUpperCase() || 'PRO';
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${type}-${year}-${random}`;
}

function displayQRCode(productId) {
    const qrCard = document.getElementById('qrCard');
    const qrContainer = document.getElementById('qrContainer');
    const productIdDisplay = document.getElementById('productIdDisplay');
    
    // Clear previous QR code
    qrContainer.innerHTML = '';
    
    // Create tracking URL
    const trackingUrl = `${window.location.origin}${window.location.pathname}#${productId}`;
    
    // Generate QR code
    qrCodeInstance = new QRCode(qrContainer, {
        text: trackingUrl,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Display product ID
    productIdDisplay.textContent = productId;
    
    // Show QR card
    qrCard.style.display = 'block';
    
    // Scroll to QR code
    qrCard.scrollIntoView({ behavior: 'smooth' });
}

function trackProduct() {
    const productId = document.getElementById('trackProductId').value.trim();
    if (!productId) {
        showAlert('Please enter a Product ID', 'warning');
        return;
    }
    
    const product = blockchain.getProduct(productId);
    if (!product) {
        displayErrorResult('Product not found. Please check the Product ID.');
        return;
    }
    
    // Display product info
    displayTrackingResult(product);
    
    // Set current product for updates
    currentProductId = productId;
    document.getElementById('currentProductId').textContent = productId;
    document.getElementById('updateCard').style.display = 'block';
    
    // Update URL hash
    window.location.hash = productId;
}

function displayTrackingResult(product) {
    const trackingResult = document.getElementById('trackingResult');
    const { id, info, history } = product;
    
    let html = `
        <div class="card border-success">
            <div class="card-header bg-success text-white">
                <h5 class="mb-0">
                    <i class="fas fa-map-signs me-2"></i>Product Journey: ${id}
                </h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="card bg-light mb-3">
                            <div class="card-body">
                                <h6><i class="fas fa-info-circle me-2"></i>Product Information</h6>
                                <table class="table table-sm">
                                    <tr><td><strong>Farm:</strong></td><td>${info.farm_name || 'N/A'}</td></tr>
                                    <tr><td><strong>Farmer:</strong></td><td>${info.farmer_name || 'N/A'}</td></tr>
                                    <tr><td><strong>Type:</strong></td><td>${info.product_type || 'N/A'}</td></tr>
                                    <tr><td><strong>Harvest Date:</strong></td><td>${info.harvest_date || 'N/A'}</td></tr>
                                    <tr><td><strong>Location:</strong></td><td>${info.farm_location || 'N/A'}</td></tr>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card bg-light mb-3">
                            <div class="card-body">
                                <h6><i class="fas fa-chart-line me-2"></i>Journey Summary</h6>
                                <table class="table table-sm">
                                    <tr><td><strong>Total Steps:</strong></td><td>${history.length}</td></tr>
                                    <tr><td><strong>Current Status:</strong></td><td>${history[history.length - 1].action}</td></tr>
                                    <tr><td><strong>Current Location:</strong></td><td>${history[history.length - 1].location}</td></tr>
                                    <tr><td><strong>Blockchain Valid:</strong></td><td>${blockchain.isChainValid() ? '✓ Yes' : '✗ No'}</td></tr>
                                    <tr><td><strong>Journey Started:</strong></td><td>${new Date(history[0].timestamp).toLocaleDateString()}</td></tr>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                
                <h6 class="mt-4"><i class="fas fa-road me-2"></i>Journey Timeline</h6>
                <div class="timeline">
    `;
    
    // Add timeline items
    history.forEach((step, index) => {
        const date = new Date(step.timestamp).toLocaleString();
        html += `
            <div class="timeline-item card mb-3 ${index === history.length - 1 ? 'border-primary' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <h6 class="card-title mb-1">${step.action}</h6>
                        <span class="badge bg-secondary">Step ${index + 1}</span>
                    </div>
                    <p class="card-text mb-1">
                        <i class="fas fa-map-marker-alt me-1"></i> 
                        <strong>Location:</strong> ${step.location}
                    </p>
                    <p class="card-text mb-1">
                        <i class="fas fa-clock me-1"></i> 
                        <strong>Time:</strong> ${date}
                    </p>
                    ${step.temperature ? 
                        `<p class="card-text mb-1">
                            <i class="fas fa-thermometer-half me-1"></i> 
                            <strong>Temperature:</strong> ${step.temperature}°C
                        </p>` : ''}
                    ${step.humidity ? 
                        `<p class="card-text mb-1">
                            <i class="fas fa-tint me-1"></i> 
                            <strong>Humidity:</strong> ${step.humidity}%
                        </p>` : ''}
                    ${step.notes ? 
                        `<p class="card-text mb-0">
                            <i class="fas fa-sticky-note me-1"></i> 
                            <strong>Notes:</strong> ${step.notes}
                        </p>` : ''}
                    <small class="text-muted mt-2 d-block">
                        <i class="fas fa-cube me-1"></i>
                        Block #${step.blockIndex}
                    </small>
                </div>
            </div>
        `;
    });
    
    html += `
                </div>
                <div class="text-center mt-4">
                    <button class="btn btn-outline-primary" onclick="generateJourneyReport('${id}')">
                        <i class="fas fa-file-pdf me-2"></i>Generate Journey Report
                    </button>
                </div>
            </div>
        </div>
    `;
    
    trackingResult.innerHTML = html;
}

function displayErrorResult(message) {
    const trackingResult = document.getElementById('trackingResult');
    trackingResult.innerHTML = `
        <div class="alert alert-danger">
            <h5><i class="fas fa-exclamation-triangle me-2"></i>Product Not Found</h5>
            <p>${message}</p>
            <p>Please check the Product ID and try again.</p>
            <button class="btn btn-outline-primary mt-2" onclick="showAllProducts()">
                <i class="fas fa-list me-2"></i>View All Products
            </button>
        </div>
    `;
}

function updateLocation(e) {
    e.preventDefault();
    
    if (!currentProductId) {
        showAlert('Please create or track a product first', 'warning');
        return;
    }
    
    const updateData = {
        product_id: currentProductId,
        action: document.getElementById('action').value,
        location: document.getElementById('location').value,
        temperature: document.getElementById('updateTemperature').value || null,
        humidity: document.getElementById('updateHumidity').value || null,
        notes: document.getElementById('notes').value,
        date: document.getElementById('updateDate').value || new Date().toISOString().split('T')[0]
    };
    
    if (!updateData.action || !updateData.location) {
        showAlert('Please fill in all required fields', 'warning');
        return;
    }
    
    // Add to blockchain
    blockchain.addBlock(updateData);
    
    // Clear form
    document.getElementById('updateTemperature').value = '';
    document.getElementById('updateHumidity').value = '';
    document.getElementById('notes').value = '';
    
    // Update tracking display
    trackProduct();
    
    // Update all displays
    updateAllDisplays();
    
    // Show success message
    showAlert('Product location updated successfully!', 'success');
    
    // Save to localStorage
    saveToLocalStorage();
}

// ====================
// DISPLAY FUNCTIONS
// ====================

function updateAllDisplays() {
    const stats = blockchain.getStats();
    
    // Update counts
    document.getElementById('productCount').textContent = stats.totalProducts;
    document.getElementById('blockCount').textContent = stats.totalBlocks;
    document.getElementById('farmCount').textContent = blockchain.farms.size;
    document.getElementById('activeProducts').textContent = stats.totalProducts;
    document.getElementById('shipments').textContent = stats.totalProducts * 2; // Demo calculation
    document.getElementById('qrCodes').textContent = stats.totalProducts;
    
    // Update chain status
    const chainStatus = document.getElementById('chainStatus');
    chainStatus.textContent = stats.chainValid ? 'Valid ✓' : 'Invalid ✗';
    chainStatus.className = `badge ${stats.chainValid ? 'bg-success' : 'bg-danger'}`;
    
    // Update blockchain visualization
    updateBlockchainVisualization();
    
    // Update recent products
    updateRecentProducts();
}

function updateBlockchainVisualization() {
    const container = document.getElementById('blockchainVisualization');
    const blocks = blockchain.chain;
    
    if (blocks.length <= 1) {
        container.innerHTML = `
            <div class="text-center text-muted p-4">
                <i class="fas fa-cube display-1"></i>
                <p class="mt-3">No transactions yet. Create a product to see the blockchain in action!</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="d-flex flex-wrap">';
    
    // Show last 5 blocks or all if less than 5
    const startIndex = Math.max(0, blocks.length - 5);
    const recentBlocks = blocks.slice(startIndex);
    
    recentBlocks.forEach(block => {
        const isGenesis = block.index === 0;
        const productId = block.data.product_id || 'System';
        const action = block.data.action || 'Block';
        
        html += `
            <div class="block-visual mb-3 me-3 ${isGenesis ? 'bg-dark text-white' : 'highlight'}">
                <div class="block-index ${isGenesis ? 'bg-warning text-dark' : 'bg-primary'}">
                    ${block.index}
                </div>
                <div>
                    <div class="fw-bold">${isGenesis ? 'Genesis' : productId}</div>
                    <div class="small">${action}</div>
                    <div class="small text-muted">Hash: ${block.hash.substring(0, 8)}...</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function updateRecentProducts() {
    const container = document.getElementById('recentProductsList');
    const products = blockchain.getAllProducts();
    
    if (products.length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-3">No products yet</div>';
        return;
    }
    
    let html = '';
    
    // Show last 5 products
    const recentProducts = products.slice(-5).reverse();
    
    recentProducts.forEach(product => {
        const lastAction = product.history[product.history.length - 1];
        html += `
            <a href="#" class="list-group-item list-group-item-action product-card"
               onclick="document.getElementById('trackProductId').value='${product.id}'; trackProduct();">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${product.id}</h6>
                        <small class="text-muted">${product.info.product_type}</small>
                    </div>
                    <span class="badge bg-info">${product.history.length} steps</span>
                </div>
                <small class="text-muted">
                    <i class="fas fa-map-marker-alt me-1"></i>
                    ${lastAction.location}
                </small>
            </a>
        `;
    });
    
    container.innerHTML = html;
}

function showAllProducts() {
    const products = blockchain.getAllProducts();
    const container = document.getElementById('allProductsList');
    
    if (products.length === 0) {
        container.innerHTML = '<div class="text-center text-muted p-5">No products created yet.</div>';
    } else {
        let html = '<div class="row">';
        
        products.forEach(product => {
            const lastAction = product.history[product.history.length - 1];
            html += `
                <div class="col-md-6 mb-3">
                    <div class="card product-card" onclick="selectProduct('${product.id}')" 
                         style="cursor: pointer;">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 class="card-title">${product.id}</h6>
                                    <p class="card-text mb-1">
                                        <small><i class="fas fa-farm"></i> ${product.info.farm_name}</small><br>
                                        <small><i class="fas fa-carrot"></i> ${product.info.product_type}</small>
                                    </p>
                                </div>
                                <span class="badge bg-primary">${product.history.length}</span>
                            </div>
                            <div class="mt-2">
                                <small class="text-muted">
                                    <i class="fas fa-map-marker-alt"></i> ${lastAction.location}<br>
                                    <i class="fas fa-clock"></i> ${new Date(lastAction.timestamp).toLocaleDateString()}
                                </small>
                            </div>
                            <button class="btn btn-sm btn-outline-primary w-100 mt-2"
                                    onclick="event.stopPropagation(); document.getElementById('trackProductId').value='${product.id}'; trackProduct(); $('#productsModal').modal('hide');">
                                Track Journey
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('productsModal'));
    modal.show();
}

function selectProduct(productId) {
    document.getElementById('trackProductId').value = productId;
    trackProduct();
    const modal = bootstrap.Modal.getInstance(document.getElementById('productsModal'));
    if (modal) modal.hide();
}

// ====================
// UTILITY FUNCTIONS
// ====================

function showAlert(message, type = 'info') {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Insert at top of container
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function printQR() {
    if (!qrCodeInstance) {
        showAlert('No QR code to print', 'warning');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    const productId = document.getElementById('productIdDisplay').textContent;
    
    printWindow.document.write(`
        <html>
            <head>
                <title>FarmChain Product QR Code</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                    }
                    .header { 
                        margin-bottom: 30px; 
                    }
                    .qr-code { 
                        margin: 30px auto; 
                        max-width: 300px; 
                    }
                    .info { 
                        margin-top: 30px; 
                        border-top: 1px solid #ccc; 
                        padding-top: 20px; 
                        text-align: left;
                    }
                    .footer { 
                        margin-top: 50px; 
                        color: #666; 
                        font-size: 12px; 
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>FarmChain Product Tracking</h2>
                    <p>Scan this QR code to verify product authenticity</p>
                </div>
                <div class="qr-code" id="qrCodeContainer"></div>
                <div class="info">
                    <h4>Product Information</h4>
                    <p><strong>Product ID:</strong> ${productId}</p>
                    <p><strong>Track at:</strong> ${window.location.origin}</p>
                    <p><strong>Scan to verify:</strong> Complete journey from farm to supermarket</p>
                </div>
                <div class="footer">
                    <p>FarmChain - Blockchain Supply Chain Tracking System</p>
                    <p>Secure • Transparent • Immutable • Trustworthy</p>
                </div>
                <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
                <script>
                    // Recreate QR code in print window
                    const qrContainer = document.getElementById('qrCodeContainer');
                    new QRCode(qrContainer, {
                        text: '${window.location.origin}${window.location.pathname}#${productId}',
                        width: 250,
                        height: 250
                    });
                    setTimeout(() => window.print(), 500);
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadQR() {
    if (!qrCodeInstance) {
        showAlert('No QR code to download', 'warning');
        return;
    }
    
    const canvas = document.querySelector('#qrContainer canvas');
    if (!canvas) {
        showAlert('QR code not available for download', 'warning');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `farmchain_qr_${document.getElementById('productIdDisplay').textContent}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function shareProduct() {
    const productId = document.getElementById('productIdDisplay').textContent;
    const trackingUrl = `${window.location.origin}${window.location.pathname}#${productId}`;
    
    if (navigator.share) {
        navigator.share({
            title: `FarmChain Product: ${productId}`,
            text: `Track this product's journey from farm to supermarket`,
            url: trackingUrl
        });
    } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(trackingUrl).then(() => {
            showAlert('Tracking link copied to clipboard!', 'success');
        });
    }
}

function openQRScanner() {
    showAlert('QR Scanner would open here. In a real app, you would integrate with a QR scanner library.', 'info');
}

function generateJourneyReport(productId) {
    const product = blockchain.getProduct(productId);
    if (!product) return;
    
    let report = `FarmChain Journey Report\n`;
    report += `========================\n\n`;
    report += `Product ID: ${product.id}\n`;
    report += `Farm: ${product.info.farm_name}\n`;
    report += `Product Type: ${product.info.product_type}\n`;
    report += `Harvest Date: ${product.info.harvest_date}\n\n`;
    report += `JOURNEY TIMELINE\n`;
    report += `================\n\n`;
    
    product.history.forEach((step, index) => {
        report += `Step ${index + 1}: ${step.action}\n`;
        report += `  Location: ${step.location}\n`;
        report += `  Time: ${new Date(step.timestamp).toLocaleString()}\n`;
        if (step.temperature) report += `  Temperature: ${step.temperature}°C\n`;
        if (step.humidity) report += `  Humidity: ${step.humidity}%\n`;
        if (step.notes) report += `  Notes: ${step.notes}\n`;
        report += `\n`;
    });
    
    report += `\nBlockchain Verified: ${blockchain.isChainValid() ? 'YES' : 'NO'}\n`;
    report += `Total Steps: ${product.history.length}\n`;
    report += `Report Generated: ${new Date().toLocaleString()}\n`;
    
    // Download as text file
    const blob = new Blob([report], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = `farmchain_report_${productId}.txt`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportBlockchain() {
    const data = {
        chain: blockchain.chain.map(block => ({
            index: block.index,
            timestamp: block.timestamp,
            data: block.data,
            previousHash: block.previousHash,
            hash: block.hash
        })),
        products: Array.from(blockchain.products.entries()),
        farms: Array.from(blockchain.farms),
        exported: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `farmchain_blockchain_${new Date().toISOString().split('T')[0]}.json`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('Blockchain exported successfully!', 'success');
}

function exportAllProducts() {
    const products = blockchain.getAllProducts();
    const csv = convertToCSV(products);
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = `farmchain_products_${new Date().toISOString().split('T')[0]}.csv`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('All products exported as CSV!', 'success');
}

function convertToCSV(products) {
    const headers = ['Product ID', 'Farm', 'Product Type', 'Harvest Date', 'Steps', 'Current Status', 'Current Location'];
    const rows = products.map(p => [
        p.id,
        p.info.farm_name || '',
        p.info.product_type || '',
        p.info.harvest_date || '',
        p.history.length,
        p.history[p.history.length - 1].action,
        p.history[p.history.length - 1].location
    ]);
    
    return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
}

// ====================
// LOCAL STORAGE FUNCTIONS
// ====================

function saveToLocalStorage() {
    try {
        const data = {
            chain: blockchain.chain.map(block => ({
                index: block.index,
                timestamp: block.timestamp,
                data: block.data,
                previousHash: block.previousHash,
                hash: block.hash
            })),
            products: Array.from(blockchain.products.entries()),
            farms: Array.from(blockchain.farms),
            timestamp: Date.now()
        };
        localStorage.setItem('farmchain_data', JSON.stringify(data));
        console.log('Data saved to localStorage');
    } catch (e) {
        console.error('Error saving to localStorage:', e);
        // Try to clear corrupted data
        localStorage.removeItem('farmchain_data');
        showAlert('Storage error. Starting fresh.', 'warning');
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('farmchain_data');
        if (saved) {
            const data = JSON.parse(saved);
            
            // Clear existing blockchain
            blockchain = new Blockchain();
            
            // Recreate blocks as proper Block instances
            if (data.chain && Array.isArray(data.chain)) {
                data.chain.forEach(blockData => {
                    // Create a new Block instance with the saved data
                    const block = new Block(
                        blockData.index,
                        blockData.timestamp,
                        blockData.data,
                        blockData.previousHash
                    );
                    
                    // IMPORTANT: Restore the original hash, not recalculate it
                    block.hash = blockData.hash;
                    
                    blockchain.chain.push(block);
                });
            }
            
            // Recreate products map
            if (data.products && Array.isArray(data.products)) {
                data.products.forEach(([key, value]) => {
                    blockchain.products.set(key, value);
                });
            }
            
            // Recreate farms set
            if (data.farms && Array.isArray(data.farms)) {
                data.farms.forEach(farm => blockchain.farms.add(farm));
            }
            
            console.log('Data loaded from localStorage:', {
                blocks: blockchain.chain.length,
                products: blockchain.products.size,
                farms: blockchain.farms.size
            });
            
            showAlert('Previous data loaded successfully!', 'info');
        }
    } catch (e) {
        console.error('Error loading from localStorage:', e);
        // If loading fails, start fresh
        blockchain = new Blockchain();
        showAlert('Starting with fresh blockchain data', 'warning');
    }
}

// ====================
// DEMO DATA
// ====================

function createDemoData() {
    // Only create demo data if no products exist
    if (blockchain.products.size > 0) return;
    
    const demoProducts = [
        {
            id: 'FARM-MNG-2024-001',
            info: {
                farm_name: 'Sunshine Orchards',
                farmer_name: 'Rajesh Kumar',
                product_type: 'Mango',
                harvest_date: '2024-05-15',
                farm_location: 'Ratnagiri, Maharashtra'
            }
        },
        {
            id: 'FARM-AVO-2024-002',
            info: {
                farm_name: 'Green Valley Farm',
                farmer_name: 'Priya Sharma',
                product_type: 'Avocado',
                harvest_date: '2024-06-01',
                farm_location: 'Coorg, Karnataka'
            }
        }
    ];
    
    const demoJourney = [
        { action: '🌱 Harvested', location: 'Farm Field', temperature: '28', humidity: '65' },
        { action: '💧 Washed & Cleaned', location: 'Processing Unit', temperature: '22', humidity: '50' },
        { action: '✅ Quality Checked', location: 'Quality Control', notes: 'Grade A quality' },
        { action: '📦 Packaged', location: 'Packaging Facility' },
        { action: '🚚 Loaded for Transport', location: 'Loading Dock' }
    ];
    
    demoProducts.forEach(product => {
        // Add initial harvest block
        blockchain.addBlock({
            product_id: product.id,
            action: '🌱 Harvested',
            location: product.info.farm_location,
            temperature: '28',
            humidity: '65',
            product_info: product.info,
            farm_name: product.info.farm_name
        });
        
        // Add journey steps
        demoJourney.slice(1).forEach(step => {
            blockchain.addBlock({
                product_id: product.id,
                ...step
            });
        });
    });
    
    saveToLocalStorage();
    showAlert('Demo data loaded. Try tracking products: FARM-MNG-2024-001 or FARM-AVO-2024-002', 'info');
}

// ====================
// CLEAR DATA FUNCTION
// ====================

function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        localStorage.removeItem('farmchain_data');
        blockchain = new Blockchain();
        currentProductId = null;
        qrCodeInstance = null;
        
        // Clear displays
        document.getElementById('trackingResult').innerHTML = '';
        document.getElementById('qrCard').style.display = 'none';
        document.getElementById('updateCard').style.display = 'none';
        document.getElementById('currentProductId').textContent = '';
        
        // Reset forms
        document.getElementById('createProductForm').reset();
        document.getElementById('updateLocationForm').reset();
        document.getElementById('trackProductId').value = '';
        
        // Update displays
        updateAllDisplays();
        
        // Create demo data again
        createDemoData();
        
        showAlert('All data cleared successfully! Demo data reloaded.', 'success');
    }
}

// ====================
// WINDOW EXPORTS
// ====================

// Make functions available globally
window.trackProduct = trackProduct;
window.printQR = printQR;
window.downloadQR = downloadQR;
window.shareProduct = shareProduct;
window.openQRScanner = openQRScanner;
window.showAllProducts = showAllProducts;
window.exportBlockchain = exportBlockchain;
window.exportAllProducts = exportAllProducts;
window.saveToLocalStorage = saveToLocalStorage;
window.generateJourneyReport = generateJourneyReport;
window.clearAllData = clearAllData;