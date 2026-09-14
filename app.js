(() => {
  'use strict';

  const APP = Object.freeze({
    name: 'PROMETEO',
    brand: 'PROMETEO',
    subtitle: '',
    version: '1.33',
    storageKey: 'dorenFashionStyle:data',
    schemaVersion: 10,
    photoDbName: 'dorenFashionStyle:assets',
    photoStoreName: 'productPhotos'
  });

  const modules = [
    { id: 'inicio', label: 'Inicio', icon: '⌂', description: 'Vista principal y accesos rápidos.' },
    { id: 'ventas', label: 'Ventas', icon: '◈', description: 'Ventas de contado y crédito.' },
    { id: 'inventario', label: 'Inventario', icon: '▦', description: 'Productos, variantes y existencias.' },
    { id: 'clientes', label: 'Clientes', icon: '♙', description: 'Fichas, saldos y estado de cuenta.' },
    { id: 'cobros', label: 'Cobros', icon: '◎', description: 'Cobros, abonos y métodos de pago.' },
    { id: 'compras', label: 'Compras', icon: '◇', description: 'Ingreso de compras y costo base.' },
    { id: 'proveedores', label: 'Proveedores', icon: '♢', description: 'Control de proveedores y pagos.' },
    { id: 'apartados', label: 'Apartados', icon: '▣', description: 'Reservas de prendas y seguimiento.' },
    { id: 'gastos', label: 'Gastos', icon: '↘', description: 'Gastos operativos del negocio.' },
    { id: 'catalogo', label: 'Catálogo', icon: '◫', description: 'Catálogo comercial visual y exportación PDF.' },
    { id: 'configuracion', label: 'Configuración', icon: '⚙', description: 'Identidad, versión y futuras preferencias.' }
  ];

  const collections = [
    'productos',
    'variantes',
    'clientes',
    'ventas',
    'cobros',
    'proveedores',
    'compras',
    'pagosProveedores',
    'apartados',
    'operacionesPostVenta',
    'gastos',
    'movimientosInventario'
  ];

  const INVENTORY_REASONS = ['Daño', 'Pérdida', 'Error de conteo', 'Obsequio', 'Corrección'];
  const PLACEHOLDER_PHOTO = `
    <svg viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      <rect width="240" height="240" rx="34" fill="#f7f1e7"/>
      <path d="M77 94c9-3 18-16 22-34h42c4 18 13 31 22 34l28 10-12 36-23-8v57H84v-57l-23 8-12-36 28-10Z" fill="#d7b368" opacity=".92"/>
      <path d="M105 60c2 9 8 14 15 14s13-5 15-14" fill="none" stroke="#081f45" stroke-width="6" stroke-linecap="round"/>
      <path d="M84 132v-19m72 19v-19" fill="none" stroke="#081f45" stroke-width="4" opacity=".65"/>
    </svg>`;


  const IDENTITY_ALLOWED_IMAGE_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);
  const IDENTITY_LOGO_MAX_INPUT_BYTES = 8 * 1024 * 1024;
  const IDENTITY_LOGO_MAX_STORED_BYTES = 700 * 1024;
  const PROMETEO_LOGO_PATH = 'assets/prometeo-logo.png';
  const LEGACY_FACTORY_IDENTITY_NAMES = new Set(['DOREN', 'DOREN FASHION & STYLE']);
  const identityLogoDraft = { main: undefined, horizontal: undefined };
  let identityLogoProcessing = 0;

  function validIdentityLogo(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    const dataUrl = String(record.dataUrl || '');
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return null;
    const base64 = match[2];
    const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
    const estimatedBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
    const declaredBytes = Math.max(0, Number(record.size) || 0);
    if (estimatedBytes > IDENTITY_LOGO_MAX_STORED_BYTES || declaredBytes > IDENTITY_LOGO_MAX_STORED_BYTES) return null;
    return {
      dataUrl,
      type: match[1],
      name: String(record.name || '').trim().slice(0, 180),
      size: declaredBytes || estimatedBytes,
      updatedAt: String(record.updatedAt || '')
    };
  }

  function createDefaultBusinessIdentity() {
    return {
      appName: APP.name,
      businessName: '',
      ownerName: '',
      slogan: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      mainLogo: null,
      horizontalLogo: null,
      updatedAt: null
    };
  }

  function normalizedIdentityLabel(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function isLegacyFactoryBusinessIdentity(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
    if (!source) return false;
    const customText = [
      source.ownerName, source.propietario, source.slogan, source.phone, source.telefono,
      source.whatsapp, source.email, source.correo, source.address, source.direccion
    ];
    if (customText.some((value) => String(value || '').trim())) return false;
    if (source.mainLogo || source.horizontalLogo) return false;
    const labels = [source.appName, source.nombre, source.businessName, source.marca]
      .map(normalizedIdentityLabel)
      .filter(Boolean);
    return labels.length > 0 && labels.every((value) => LEGACY_FACTORY_IDENTITY_NAMES.has(value));
  }

  function normalizeBusinessIdentity(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    if (isLegacyFactoryBusinessIdentity(source)) return createDefaultBusinessIdentity();
    const defaults = createDefaultBusinessIdentity();
    const hasBusinessName = Object.prototype.hasOwnProperty.call(source, 'businessName');
    const rawBusinessName = hasBusinessName ? source.businessName : source.marca;
    const rawAppName = Object.prototype.hasOwnProperty.call(source, 'appName') ? source.appName : source.nombre;
    return {
      appName: String(rawAppName || defaults.appName).trim() || defaults.appName,
      businessName: String(rawBusinessName || '').trim(),
      ownerName: String(source.ownerName || source.propietario || '').trim(),
      slogan: String(source.slogan || '').trim(),
      phone: String(source.phone || source.telefono || '').trim(),
      whatsapp: String(source.whatsapp || '').trim(),
      email: String(source.email || source.correo || '').trim(),
      address: String(source.address || source.direccion || '').trim(),
      mainLogo: validIdentityLogo(source.mainLogo),
      horizontalLogo: validIdentityLogo(source.horizontalLogo),
      updatedAt: source.updatedAt ? String(source.updatedAt) : null
    };
  }

  function businessIdentityDisplayName(identity) {
    return String(identity?.businessName || identity?.appName || APP.name).trim() || APP.name;
  }

  function resetIdentityLogoDraft() {
    identityLogoDraft.main = undefined;
    identityLogoDraft.horizontal = undefined;
    identityLogoProcessing = 0;
  }

  function getBusinessIdentity(state = store.getState()) {
    return normalizeBusinessIdentity(state?.configuraciones?.identidad);
  }

  function businessIdentityMainLogoSrc(identity) {
    return identity?.mainLogo?.dataUrl || PROMETEO_LOGO_PATH;
  }

  function businessIdentityHorizontalLogoSrc(identity) {
    return identity?.horizontalLogo?.dataUrl || identity?.mainLogo?.dataUrl || PROMETEO_LOGO_PATH;
  }

  function armBusinessLogoFallback(image) {
    if (!image || image.dataset.businessLogoArmed === 'true') return;
    image.dataset.businessLogoArmed = 'true';
    image.addEventListener('error', () => {
      if (image.dataset.businessLogoFallbackApplied === 'true') return;
      image.dataset.businessLogoFallbackApplied = 'true';
      image.src = PROMETEO_LOGO_PATH;
    });
  }

  function setBusinessLogoSource(image, source, altText = '') {
    if (!image) return;
    image.dataset.businessLogo = 'true';
    delete image.dataset.businessLogoFallbackApplied;
    armBusinessLogoFallback(image);
    image.src = source || PROMETEO_LOGO_PATH;
    if (altText) image.alt = altText;
  }

  function armBusinessLogoFallbacks(root = document) {
    root.querySelectorAll?.('[data-business-logo="true"]').forEach((image) => armBusinessLogoFallback(image));
  }

  function businessIdentityContactItems(identity) {
    return [
      identity?.phone ? `Tel. ${identity.phone}` : '',
      identity?.whatsapp ? `WhatsApp ${identity.whatsapp}` : '',
      identity?.email || '',
      identity?.address || ''
    ].filter(Boolean);
  }

  function businessIdentityFilenameToken(identity) {
    const source = businessIdentityDisplayName(identity);
    const token = source.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return token || APP.brand;
  }

  function syncGlobalIdentityShell(identity = getBusinessIdentity()) {
    const businessName = businessIdentityDisplayName(identity);
    const appName = identity.appName || APP.name;
    const mainLogo = businessIdentityMainLogoSrc(identity);
    const horizontalLogo = businessIdentityHorizontalLogoSrc(identity);

    const sidebarLogo = document.getElementById('sidebarBrandLogo');
    if (sidebarLogo) {
      setBusinessLogoSource(sidebarLogo, mainLogo, businessName);
      sidebarLogo.closest('.brand')?.setAttribute('aria-label', businessName);
    }

    const topbarLogo = document.getElementById('topbarBrandLogo');
    if (topbarLogo) {
      setBusinessLogoSource(topbarLogo, horizontalLogo, businessName);
      topbarLogo.closest('.topbar__brand')?.setAttribute('aria-label', `Ir a Inicio · ${businessName}`);
    }

    const topbarBusinessName = document.getElementById('topbarBusinessName');
    if (topbarBusinessName) {
      topbarBusinessName.textContent = businessName;
      topbarBusinessName.title = businessName;
    }

    const footerBusinessName = document.getElementById('footerBusinessName');
    if (footerBusinessName) {
      footerBusinessName.textContent = businessName;
      footerBusinessName.title = businessName;
    }

    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', `${businessName} — gestión sencilla para un emprendimiento de moda.`);

    document.documentElement.dataset.businessIdentity = businessName;
    document.documentElement.dataset.appIdentity = appName;
  }

  class DorenStore {
    constructor(key) {
      this.key = key;
      this.ensureSchema();
    }

    createEmptyState() {
      const now = new Date().toISOString();
      const state = {
        meta: {
          schemaVersion: APP.schemaVersion,
          appName: APP.name,
          appVersion: APP.version,
          createdAt: now,
          updatedAt: now
        },
        configuraciones: {
          identidad: createDefaultBusinessIdentity(),
          gastosCategorias: ['Transporte', 'Publicidad', 'Bolsas', 'Delivery', 'Empaque'],
          respaldo: {
            lastExportAt: null,
            lastImportAt: null
          }
        }
      };
      collections.forEach((name) => { state[name] = []; });
      return state;
    }

    ensureSchema() {
      const existing = this.readRaw();
      if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
        this.writeRaw(this.createEmptyState());
        return;
      }

      let changed = false;
      if (!existing.meta || typeof existing.meta !== 'object') { existing.meta = {}; changed = true; }
      if (!existing.meta.schemaVersion || existing.meta.schemaVersion < APP.schemaVersion) { existing.meta.schemaVersion = APP.schemaVersion; changed = true; }
      if (existing.meta.appName !== APP.name) { existing.meta.appName = APP.name; changed = true; }
      if (existing.meta.appVersion !== APP.version) { existing.meta.appVersion = APP.version; changed = true; }
      if (!existing.meta.createdAt) { existing.meta.createdAt = new Date().toISOString(); changed = true; }

      collections.forEach((name) => {
        if (!Array.isArray(existing[name])) { existing[name] = []; changed = true; }
      });

      existing.productos = existing.productos.map((product) => {
        const migrated = { ...product };
        if (typeof migrated.active !== 'boolean') migrated.active = true;
        if (!Number.isFinite(Number(migrated.lowStockThreshold))) migrated.lowStockThreshold = 2;
        if (!('photoMeta' in migrated)) migrated.photoMeta = null;
        if (!migrated.createdAt) migrated.createdAt = new Date().toISOString();
        if (!migrated.updatedAt) migrated.updatedAt = migrated.createdAt;
        return migrated;
      });

      existing.variantes = existing.variantes.map((variant) => ({
        ...variant,
        stock: Math.max(0, Number.parseInt(variant.stock, 10) || 0),
        lowStockThreshold: variant.lowStockThreshold === null || variant.lowStockThreshold === '' || typeof variant.lowStockThreshold === 'undefined'
          ? null
          : Math.max(0, Number.parseInt(variant.lowStockThreshold, 10) || 0),
        purchasePriceOverride: Number.isFinite(Number(variant.purchasePriceOverride)) ? Number(variant.purchasePriceOverride) : null,
        salePriceOverride: Number.isFinite(Number(variant.salePriceOverride)) ? Number(variant.salePriceOverride) : null
      }));

      existing.clientes = existing.clientes.map((client) => {
        const migrated = { ...client };
        if (!migrated.id) migrated.id = uid('cli');
        migrated.name = String(migrated.name || migrated.nombre || '').trim();
        migrated.phone = String(migrated.phone || migrated.telefono || migrated.whatsapp || '').trim();
        migrated.address = String(migrated.address || migrated.direccion || '').trim();
        migrated.observation = String(migrated.observation || migrated.observacion || '').trim();
        if (!migrated.createdAt) migrated.createdAt = new Date().toISOString();
        if (!migrated.updatedAt) migrated.updatedAt = migrated.createdAt;
        delete migrated.nombre;
        delete migrated.telefono;
        delete migrated.whatsapp;
        delete migrated.direccion;
        delete migrated.observacion;
        return migrated;
      });

      existing.ventas = existing.ventas.map((sale) => {
        const migrated = { ...sale };
        if (!migrated.id) { migrated.id = uid('ven'); changed = true; }
        if (String(migrated.type || '').toLowerCase() === 'credito') {
          if (!('totalPaid' in migrated)) { migrated.totalPaid = Math.max(0, Number(migrated.initialPayment) || 0); changed = true; }
          if (!('paymentStatus' in migrated)) {
            const balance = Math.max(0, Number(migrated.balance) || 0);
            migrated.paymentStatus = balance <= 0.005 ? 'pagado' : ((Number(migrated.initialPayment) || 0) > 0 ? 'abonado' : 'pendiente');
            changed = true;
          }
        }
        return migrated;
      });

      existing.cobros = existing.cobros.map((payment) => {
        const migrated = { ...payment };
        if (!migrated.id) { migrated.id = uid('cob'); changed = true; }
        if (!migrated.createdAt) { migrated.createdAt = migrated.date || new Date().toISOString(); changed = true; }
        if (!migrated.status) { migrated.status = 'confirmado'; changed = true; }
        return migrated;
      });

      existing.proveedores = existing.proveedores.map((provider) => {
        const migrated = { ...provider };
        if (!migrated.id) { migrated.id = uid('pro'); changed = true; }
        migrated.name = String(migrated.name || migrated.nombre || '').trim();
        migrated.phone = String(migrated.phone || migrated.telefono || '').trim();
        migrated.address = String(migrated.address || migrated.direccion || '').trim();
        migrated.observation = String(migrated.observation || migrated.observacion || '').trim();
        if (!migrated.createdAt) { migrated.createdAt = new Date().toISOString(); changed = true; }
        if (!migrated.updatedAt) { migrated.updatedAt = migrated.createdAt; changed = true; }
        delete migrated.nombre;
        delete migrated.telefono;
        delete migrated.direccion;
        delete migrated.observacion;
        return migrated;
      });

      existing.compras = existing.compras.map((purchase) => {
        const migrated = { ...purchase };
        if (!migrated.id) { migrated.id = uid('com'); changed = true; }
        if (!migrated.createdAt) { migrated.createdAt = migrated.date || new Date().toISOString(); changed = true; }
        if (!migrated.updatedAt) { migrated.updatedAt = migrated.createdAt; changed = true; }
        if (!migrated.status) { migrated.status = 'confirmada'; changed = true; }
        if (!('totalPaid' in migrated)) { migrated.totalPaid = Math.max(0, Number(migrated.initialPayment || migrated.pagoInicial) || 0); changed = true; }
        if (!('balance' in migrated)) { migrated.balance = Math.max(0, (Number(migrated.total) || 0) - (Number(migrated.totalPaid) || 0)); changed = true; }
        return migrated;
      });

      existing.pagosProveedores = existing.pagosProveedores.map((payment) => {
        const migrated = { ...payment };
        if (!migrated.id) { migrated.id = uid('pagpro'); changed = true; }
        if (!migrated.createdAt) { migrated.createdAt = migrated.date || new Date().toISOString(); changed = true; }
        if (!migrated.status) { migrated.status = 'confirmado'; changed = true; }
        return migrated;
      });

      if (!existing.configuraciones || typeof existing.configuraciones !== 'object') { existing.configuraciones = {}; changed = true; }
      const normalizedIdentity = normalizeBusinessIdentity(existing.configuraciones.identidad);
      if (JSON.stringify(existing.configuraciones.identidad || {}) !== JSON.stringify(normalizedIdentity)) {
        existing.configuraciones.identidad = normalizedIdentity;
        changed = true;
      }
      if (!existing.configuraciones.respaldo || typeof existing.configuraciones.respaldo !== 'object') {
        existing.configuraciones.respaldo = { lastExportAt: null, lastImportAt: null };
        changed = true;
      } else {
        if (!('lastExportAt' in existing.configuraciones.respaldo)) { existing.configuraciones.respaldo.lastExportAt = null; changed = true; }
        if (!('lastImportAt' in existing.configuraciones.respaldo)) { existing.configuraciones.respaldo.lastImportAt = null; changed = true; }
      }

      const defaultExpenseCategories = ['Transporte', 'Publicidad', 'Bolsas', 'Delivery', 'Empaque'];
      if (!Array.isArray(existing.configuraciones.gastosCategorias) || !existing.configuraciones.gastosCategorias.length) {
        existing.configuraciones.gastosCategorias = defaultExpenseCategories.slice();
        changed = true;
      } else {
        const normalizedCategories = Array.from(new Set(existing.configuraciones.gastosCategorias.map((item) => String(item || '').trim()).filter(Boolean)));
        if (JSON.stringify(normalizedCategories) !== JSON.stringify(existing.configuraciones.gastosCategorias)) changed = true;
        existing.configuraciones.gastosCategorias = normalizedCategories.length ? normalizedCategories : defaultExpenseCategories.slice();
      }

      existing.gastos = existing.gastos.map((expense) => {
        const migrated = { ...expense };
        if (!migrated.id) { migrated.id = uid('gas'); changed = true; }
        migrated.date = migrated.date || migrated.fecha || migrated.createdAt || new Date().toISOString();
        migrated.category = String(migrated.category || migrated.categoria || 'Otros').trim() || 'Otros';
        migrated.description = String(migrated.description || migrated.descripcion || '').trim();
        migrated.amount = Math.max(0, Number(migrated.amount ?? migrated.monto) || 0);
        migrated.method = String(migrated.method || migrated.metodo || 'Efectivo').trim();
        if (!['Efectivo', 'Transferencia', 'Tarjeta'].includes(migrated.method)) migrated.method = 'Efectivo';
        if (!migrated.status) migrated.status = 'confirmado';
        if (!migrated.createdAt) migrated.createdAt = migrated.date || new Date().toISOString();
        if (!migrated.updatedAt) migrated.updatedAt = migrated.createdAt;
        delete migrated.fecha;
        delete migrated.categoria;
        delete migrated.descripcion;
        delete migrated.monto;
        delete migrated.metodo;
        return migrated;
      });

      if (changed) {
        existing.meta.updatedAt = new Date().toISOString();
        this.writeRaw(existing);
      }
    }

    readRaw() {
      try {
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.error('[DOREN] No se pudo leer almacenamiento local.', error);
        return null;
      }
    }

    writeRaw(value) {
      try {
        value.meta = value.meta || {};
        value.meta.schemaVersion = APP.schemaVersion;
        value.meta.appName = APP.name;
        value.meta.appVersion = APP.version;
        value.meta.updatedAt = new Date().toISOString();
        localStorage.setItem(this.key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('[DOREN] No se pudo guardar almacenamiento local.', error);
        return false;
      }
    }

    getState() {
      return this.readRaw() || this.createEmptyState();
    }

    transact(mutator) {
      const state = this.getState();
      mutator(state);
      return this.writeRaw(state);
    }
  }

  class PhotoStore {
    constructor(dbName, storeName) {
      this.dbName = dbName;
      this.storeName = storeName;
      this.dbPromise = null;
    }

    open() {
      if (this.dbPromise) return this.dbPromise;
      this.dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
          reject(new Error('IndexedDB no disponible'));
          return;
        }
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB'));
      });
      return this.dbPromise;
    }

    async put(productId, file) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(file, productId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('No se pudo guardar la foto'));
      });
    }

    async get(productId) {
      try {
        const db = await this.open();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const request = tx.objectStore(this.storeName).get(productId);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error || new Error('No se pudo leer la foto'));
        });
      } catch (error) {
        console.warn('[DOREN] Foto no disponible.', error);
        return null;
      }
    }

    async remove(productId) {
      try {
        const db = await this.open();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          tx.objectStore(this.storeName).delete(productId);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error || new Error('No se pudo quitar la foto'));
        });
      } catch (error) {
        console.warn('[DOREN] No se pudo quitar la foto.', error);
        return false;
      }
    }

    async entries() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const storeRef = tx.objectStore(this.storeName);
        const keysRequest = storeRef.getAllKeys();
        const valuesRequest = storeRef.getAll();
        tx.oncomplete = () => {
          const keys = keysRequest.result || [];
          const values = valuesRequest.result || [];
          resolve(keys.map((key, index) => [String(key), values[index]]));
        };
        tx.onerror = () => reject(tx.error || new Error('No se pudieron leer las fotos'));
      });
    }

    async clear() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('No se pudieron borrar las fotos'));
        tx.onabort = () => reject(tx.error || new Error('Se canceló el borrado de fotos'));
      });
    }

    async count() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const request = tx.objectStore(this.storeName).count();
        request.onsuccess = () => resolve(Number(request.result) || 0);
        request.onerror = () => reject(request.error || new Error('No se pudo verificar el total de fotos'));
        tx.onerror = () => reject(tx.error || new Error('No se pudo verificar IndexedDB'));
      });
    }

    async replaceAll(entries) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const storeRef = tx.objectStore(this.storeName);
        storeRef.clear();
        entries.forEach(([key, value]) => storeRef.put(value, key));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('No se pudieron reemplazar las fotos'));
        tx.onabort = () => reject(tx.error || new Error('Se canceló la restauración de fotos'));
      });
    }
  }

  const store = new DorenStore(APP.storageKey);
  const photoStore = new PhotoStore(APP.photoDbName, APP.photoStoreName);
  const objectUrls = new Set();
  let inventorySearch = '';
  let inventoryFilter = 'todos';
  const expandedInventoryProductIds = new Set();
  let lastRenderedRoute = '';
  let dangerBackupAuthorization = null;
  let backupImportBusy = false;
  let dangerDeleteFlow = {
    phase: 'backup-required',
    operationId: null,
    keywordValid: false,
    busy: false,
    preparedAt: null,
    completedAt: null
  };
  let clientSearch = '';
  let selectedClientId = null;
  let saleSearch = '';
  let saleTypeFilter = 'todos';
  let collectionSearch = '';
  let collectionStatusFilter = 'por-cobrar';
  let providerSearch = '';
  let selectedProviderId = null;
  let purchaseSearch = '';
  let purchaseTypeFilter = 'todos';
  let purchaseStatusFilter = 'todos';
  let summaryMonth = String(new Date().getMonth() + 1);
  let summaryYear = String(new Date().getFullYear());
  let expenseMonth = 'todos';
  let expenseYear = String(new Date().getFullYear());
  let catalogMode = 'completo';
  let deferredInstallPrompt = null;
  let swRegistration = null;
  let swRegistrationPromise = null;
  let swUpdateCheckPromise = null;
  let reloadingForServiceWorker = false;
  let hasSeenServiceWorkerController = Boolean(('serviceWorker' in navigator) && navigator.serviceWorker.controller);
  const SW_UPDATE_APPLIED_SESSION_KEY = 'doren:pwa:update-applied';
  const SW_ROOT_MIGRATION_RELOAD_KEY = 'doren:pwa:root-sw-migration-reload';
  const DANGER_DELETE_COMPLETED_SESSION_KEY = 'prometeo:danger-delete-completed';
  const SW_SCOPE_URL = new URL('./', document.baseURI).href;
  const SW_ROOT_SCRIPT_URL = new URL('service-worker.js', document.baseURI).href;
  const SW_LEGACY_SCRIPT_URL = new URL('pwa/service-worker.js', document.baseURI).href;
  const observedSwRegistrations = new WeakSet();
  const observedSwWorkers = new WeakSet();
  const announcedSwUpdateWorkers = new WeakSet();
  const swRuntimeState = {
    phase: ('serviceWorker' in navigator) ? 'initializing' : 'unsupported',
    error: null
  };

  const els = {
    content: document.getElementById('appContent'),
    navList: document.getElementById('navList'),
    currentSection: document.getElementById('currentSection'),
    sidebar: document.getElementById('sidebar'),
    menuButton: document.getElementById('menuButton'),
    scrim: document.getElementById('scrim'),
    footerVersion: document.getElementById('footerVersion')
  };

  function uid(prefix = 'id') {
    if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function money(value) {
    const number = Number(value) || 0;
    return `C$${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)}`;
  }

  function quantity(value) {
    return new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function moneyInputValue(value, fallback = '') {
    if (value === '' || value === null || typeof value === 'undefined') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : fallback;
  }

  function normalizeNumericInput(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== 'number' || input.value === '') return;
    const number = Number(input.value);
    if (!Number.isFinite(number)) return;
    if (String(input.step) === '0.01') {
      input.value = number.toFixed(2);
      return;
    }
    if (String(input.step) === '1') input.value = String(Math.trunc(number));
  }

  function normalizeNumericInputs(root = document) {
    root.querySelectorAll('input[type="number"]').forEach(normalizeNumericInput);
  }

  function autoSelectNumericInput(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== 'number' || input.disabled || input.readOnly || input.value === '') return;
    window.setTimeout(() => {
      if (document.activeElement !== input || input.value === '') return;
      try { input.select(); } catch (error) { /* Algunos navegadores limitan select() en type=number. */ }
    }, 0);
  }

  function formatDate(value, includeTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (includeTime) Object.assign(options, { hour: '2-digit', minute: '2-digit', hour12: false });
    return new Intl.DateTimeFormat('es-NI', options).format(date);
  }

  function safeRoute() {
    const route = (location.hash || '#inicio').replace('#', '').trim().toLowerCase();
    return modules.some((item) => item.id === route) ? route : 'inicio';
  }

  function productVariants(state, productId) {
    return state.variantes.filter((variant) => variant.productId === productId);
  }

  function totalStock(state, productId) {
    return productVariants(state, productId).reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
  }

  function isApartadoActive(apartado) {
    return ['activo', 'abonado'].includes(String(apartado?.status || '').toLowerCase());
  }

  function reservedStockForVariant(state, variantId, excludeApartadoId = '') {
    return state.apartados
      .filter((apartado) => isApartadoActive(apartado))
      .filter((apartado) => String(apartado.variantId || '') === String(variantId))
      .filter((apartado) => !excludeApartadoId || String(apartado.id) !== String(excludeApartadoId))
      .reduce((sum, apartado) => sum + Math.max(0, Number.parseInt(apartado.quantity, 10) || 0), 0);
  }

  function availableStockForVariant(state, variantId, excludeApartadoId = '') {
    const variant = state.variantes.find((item) => String(item.id) === String(variantId));
    if (!variant) return 0;
    return Math.max(0, (Number(variant.stock) || 0) - reservedStockForVariant(state, variantId, excludeApartadoId));
  }

  function totalReservedStock(state, productId) {
    return productVariants(state, productId).reduce((sum, variant) => sum + reservedStockForVariant(state, variant.id), 0);
  }

  function totalAvailableStock(state, productId) {
    return productVariants(state, productId).reduce((sum, variant) => sum + availableStockForVariant(state, variant.id), 0);
  }

  function productAvailability(state, product) {
    if (!product.active) return 'inactivo';
    return totalAvailableStock(state, product.id) <= 0 ? 'agotado' : 'activo';
  }

  function variantThreshold(product, variant) {
    if (variant.lowStockThreshold !== null && typeof variant.lowStockThreshold !== 'undefined') return Number(variant.lowStockThreshold) || 0;
    return Number(product.lowStockThreshold) || 0;
  }

  function isVariantLow(state, product, variant) {
    const stock = availableStockForVariant(state, variant.id);
    return stock > 0 && stock <= variantThreshold(product, variant);
  }

  function isProductLow(state, product) {
    if (!product.active) return false;
    const variants = productVariants(state, product.id);
    if (!variants.length) return false;
    return variants.some((variant) => isVariantLow(state, product, variant));
  }

  function variantLabel(variant) {
    const pieces = [];
    if (String(variant.color || '').trim()) pieces.push(String(variant.color).trim());
    if (String(variant.size || '').trim()) pieces.push(String(variant.size).trim());
    return pieces.length ? pieces.join(' / ') : 'Sin variante';
  }

  function renderNavigation() {
    els.navList.innerHTML = modules.map((item) => `
      <a class="nav-item" href="#${item.id}" data-route="${item.id}">
        <span class="nav-item__icon" aria-hidden="true">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `).join('');
  }

  const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function recordDateKey(record, keys = ['date', 'fecha', 'createdAt']) {
    for (const key of keys) {
      const value = record?.[key];
      if (!value) continue;
      const text = String(value);
      const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return localDateKey(date);
    }
    return '';
  }

  function matchesPeriod(record, month, year, keys) {
    const dateKey = recordDateKey(record, keys);
    if (!dateKey) return false;
    const [recordYear, recordMonth] = dateKey.split('-');
    if (String(year) !== 'todos' && recordYear !== String(year)) return false;
    if (String(month) !== 'todos' && Number(recordMonth) !== Number(month)) return false;
    return true;
  }

  function operationalYears(state) {
    const years = new Set([String(new Date().getFullYear())]);
    ['ventas', 'cobros', 'compras', 'pagosProveedores', 'gastos'].forEach((collection) => {
      (state[collection] || []).forEach((record) => {
        const key = recordDateKey(record);
        if (key) years.add(key.slice(0, 4));
      });
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }

  function periodOptions(state, selectedMonth, selectedYear, prefix) {
    const years = operationalYears(state);
    return `
      <label class="filter-control"><span>Mes</span><select id="${prefix}Month">
        <option value="todos" ${selectedMonth === 'todos' ? 'selected' : ''}>Todos</option>
        ${MONTH_LABELS.map((label, index) => `<option value="${index + 1}" ${String(selectedMonth) === String(index + 1) ? 'selected' : ''}>${label}</option>`).join('')}
      </select></label>
      <label class="filter-control"><span>Año</span><select id="${prefix}Year">
        <option value="todos" ${selectedYear === 'todos' ? 'selected' : ''}>Todos</option>
        ${years.map((year) => `<option value="${year}" ${String(selectedYear) === String(year) ? 'selected' : ''}>${year}</option>`).join('')}
      </select></label>`;
  }

  function inventoryApproxValue(state) {
    return state.variantes.reduce((sum, variant) => {
      const product = state.productos.find((item) => item.id === variant.productId);
      if (!product) return sum;
      const stock = Math.max(0, Number(variant.stock) || 0);
      return sum + (stock * effectiveVariantPurchasePrice(product, variant));
    }, 0);
  }

  function periodCollectionsTotal(state, month, year) {
    let total = state.cobros
      .filter((payment) => !isPaymentCancelled(payment))
      .filter((payment) => matchesPeriod(payment, month, year))
      .reduce((sum, payment) => sum + Math.max(0, numericValue(payment, ['amount', 'monto', 'total', 'importe'])), 0);

    state.ventas.filter((sale) => !isSaleCancelled(sale)).forEach((sale) => {
      const hasLinked = state.cobros.some((payment) => String(payment.saleId || payment.ventaId || '') === String(sale.id) && !isPaymentCancelled(payment));
      if (hasLinked || !matchesPeriod(sale, month, year)) return;
      const legacyPaid = Math.max(0, numericValue(sale, ['initialPayment', 'abonoInicial']));
      total += legacyPaid;
    });
    return total;
  }

  function periodSupplierPaymentsTotal(state, month, year) {
    let total = state.pagosProveedores
      .filter((payment) => !isSupplierPaymentCancelled(payment))
      .filter((payment) => matchesPeriod(payment, month, year))
      .reduce((sum, payment) => sum + Math.max(0, numericValue(payment, ['amount', 'monto', 'total', 'importe'])), 0);

    state.compras.filter((purchase) => !isPurchaseCancelled(purchase)).forEach((purchase) => {
      const hasLinked = state.pagosProveedores.some((payment) => String(payment.purchaseId || payment.compraId || '') === String(purchase.id) && !isSupplierPaymentCancelled(payment));
      if (hasLinked || !matchesPeriod(purchase, month, year)) return;
      total += Math.max(0, numericValue(purchase, ['initialPayment', 'pagoInicial']));
    });
    return total;
  }

  function saleCostSnapshot(sale) {
    if (Array.isArray(sale.lines) && sale.lines.length) {
      return sale.lines.reduce((sum, line) => {
        const qty = Math.max(0, Number.parseInt(line.quantity, 10) || 0);
        const cost = Math.max(0, Number(line.purchasePrice ?? line.purchasePriceSnapshot) || 0);
        return sum + (qty * cost);
      }, 0);
    }
    const total = numericValue(sale, ['total', 'netTotal', 'totalNeto']);
    const utility = numericValue(sale, ['totalUtility', 'utilidadTotal']);
    return Math.max(0, total - utility);
  }

  function lowStockAlerts(state) {
    const alerts = [];
    state.productos.filter((product) => product.active).forEach((product) => {
      productVariants(state, product.id).forEach((variant) => {
        const available = availableStockForVariant(state, variant.id);
        const threshold = variantThreshold(product, variant);
        if (available <= threshold) {
          alerts.push({ product, variant, available, threshold });
        }
      });
    });
    return alerts.sort((a, b) => a.available - b.available || String(a.product.name).localeCompare(String(b.product.name), 'es'));
  }

  function overdueClientAlerts(state) {
    const grouped = new Map();
    const today = localDateKey();
    state.ventas.filter((sale) => !isSaleCancelled(sale) && String(sale.type || '').toLowerCase() === 'credito').forEach((sale) => {
      const financial = saleFinancialState(state, sale, today);
      if (financial.statusKey !== 'vencido' || financial.balance <= 0.005) return;
      const key = String(sale.clientId || saleClientName(state, sale));
      const current = grouped.get(key) || { name: saleClientName(state, sale), balance: 0, count: 0, dueDate: financial.dueDate };
      current.balance += financial.balance;
      current.count += 1;
      if (financial.dueDate && (!current.dueDate || financial.dueDate < current.dueDate)) current.dueDate = financial.dueDate;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.balance - a.balance);
  }

  function overdueProviderAlerts(state) {
    const grouped = new Map();
    const today = localDateKey();
    state.compras.filter((purchase) => !isPurchaseCancelled(purchase) && String(purchase.type || '').toLowerCase() === 'credito').forEach((purchase) => {
      const financial = purchaseFinancialState(state, purchase, today);
      if (financial.statusKey !== 'vencido' || financial.balance <= 0.005) return;
      const key = String(purchase.providerId || purchaseProviderName(state, purchase));
      const current = grouped.get(key) || { name: purchaseProviderName(state, purchase), balance: 0, count: 0, dueDate: financial.dueDate };
      current.balance += financial.balance;
      current.count += 1;
      if (financial.dueDate && (!current.dueDate || financial.dueDate < current.dueDate)) current.dueDate = financial.dueDate;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.balance - a.balance);
  }

  function operationalSummary(state, month = summaryMonth, year = summaryYear) {
    const periodSales = state.ventas.filter((sale) => !isSaleCancelled(sale) && matchesPeriod(sale, month, year));
    const periodPurchases = state.compras.filter((purchase) => !isPurchaseCancelled(purchase) && matchesPeriod(purchase, month, year));
    const periodExpenses = state.gastos.filter((expense) => !isExpenseCancelled(expense) && matchesPeriod(expense, month, year));
    const salesGross = periodSales.reduce((sum, sale) => sum + numericValue(sale, ['subtotalBruto', 'grossSubtotal', 'subtotal', 'total']), 0);
    const discounts = periodSales.reduce((sum, sale) => sum + numericValue(sale, ['discountTotal', 'descuentoTotal', 'descuentos']), 0);
    const salesNet = periodSales.reduce((sum, sale) => sum + numericValue(sale, ['total', 'netTotal', 'totalNeto']), 0);
    const costOfGoods = periodSales.reduce((sum, sale) => sum + saleCostSnapshot(sale), 0);
    const grossUtility = salesNet - costOfGoods;
    const expenses = periodExpenses.reduce((sum, expense) => sum + Math.max(0, Number(expense.amount) || 0), 0);
    return {
      salesGross,
      discounts,
      salesNet,
      totalCollected: periodCollectionsTotal(state, month, year),
      receivable: periodSales.reduce((sum, sale) => sum + saleFinancialState(state, sale).balance, 0),
      purchases: periodPurchases.reduce((sum, purchase) => sum + purchaseFinancialState(state, purchase).total, 0),
      supplierPaid: periodSupplierPaymentsTotal(state, month, year),
      payable: periodPurchases.reduce((sum, purchase) => sum + purchaseFinancialState(state, purchase).balance, 0),
      inventoryValue: inventoryApproxValue(state),
      costOfGoods,
      grossUtility,
      expenses,
      operatingResult: grossUtility - expenses,
      lowStock: lowStockAlerts(state),
      overdueClients: overdueClientAlerts(state),
      overdueProviders: overdueProviderAlerts(state)
    };
  }

  function renderAlertList(items, type) {
    if (!items.length) return '<div class="dashboard-empty-alert">Sin alertas en este momento.</div>';
    return items.slice(0, 6).map((item) => {
      if (type === 'stock') {
        return `<div class="dashboard-alert-row"><div><strong>${escapeHtml(item.product.name)}</strong><span>${escapeHtml(variantLabel(item.variant))} · umbral ${quantity(item.threshold)}</span></div><strong>${quantity(item.available)} disp.</strong></div>`;
      }
      return `<div class="dashboard-alert-row"><div><strong>${escapeHtml(item.name)}</strong><span>${quantity(item.count)} documento${item.count === 1 ? '' : 's'} · desde ${item.dueDate ? formatDate(`${item.dueDate}T12:00:00`) : '—'}</span></div><strong>${money(item.balance)}</strong></div>`;
    }).join('');
  }

  function renderHome() {
    const state = store.getState();
    const identity = getBusinessIdentity(state);
    const identityDisplayName = businessIdentityDisplayName(identity);
    const mainLogoSrc = businessIdentityMainLogoSrc(identity);
    const summary = operationalSummary(state);
    const quickModules = modules.filter((item) => ['ventas', 'inventario', 'clientes', 'cobros', 'compras', 'proveedores', 'gastos'].includes(item.id));
    const periodLabel = summaryMonth === 'todos' && summaryYear === 'todos'
      ? 'Todos los períodos'
      : `${summaryMonth === 'todos' ? 'Todos los meses' : MONTH_LABELS[Number(summaryMonth) - 1]}${summaryYear === 'todos' ? '' : ` ${summaryYear}`}`;

    return `
      <section class="dashboard-page" aria-labelledby="homeTitle">
        <div class="dashboard-heading">
          <div>
            <p class="hero__eyebrow">${escapeHtml(identityDisplayName)} · TABLERO OPERATIVO</p>
            <h1 id="homeTitle">Inicio</h1>
            <p class="dashboard-heading__summary">Resultados, saldos y alertas para decidir rápido sin convertir la app en contabilidad formal.</p>
            ${(identity.slogan || identity.ownerName) ? `<div class="dashboard-heading__identity-meta">${identity.slogan ? `<span>${escapeHtml(identity.slogan)}</span>` : ''}${identity.ownerName ? `<small>Propietario: ${escapeHtml(identity.ownerName)}</small>` : ''}</div>` : ''}
          </div>
          <div class="dashboard-heading__logo-wrap" aria-label="${escapeHtml(identityDisplayName)}">
            <img data-business-logo="true" src="${mainLogoSrc}" alt="${escapeHtml(identityDisplayName)}" class="dashboard-heading__logo">
          </div>
        </div>

        <div class="dashboard-filterbar">
          <div><strong>Período</strong><span>${escapeHtml(periodLabel)}</span></div>
          <div class="dashboard-filterbar__controls">${periodOptions(state, summaryMonth, summaryYear, 'summary')}</div>
        </div>

        <section class="dashboard-kpis dashboard-kpis--primary" aria-label="Ventas y resultado">
          <article class="metric-card"><span>Ventas brutas</span><strong>${money(summary.salesGross)}</strong></article>
          <article class="metric-card metric-card--warning"><span>Descuentos</span><strong>${money(summary.discounts)}</strong></article>
          <article class="metric-card metric-card--accent"><span>Ventas netas</span><strong>${money(summary.salesNet)}</strong></article>
          <article class="metric-card"><span>Costo mercadería vendida</span><strong>${money(summary.costOfGoods)}</strong></article>
          <article class="metric-card"><span>Utilidad bruta real</span><strong>${money(summary.grossUtility)}</strong></article>
          <article class="metric-card ${summary.operatingResult < 0 ? 'metric-card--danger' : 'metric-card--accent'}"><span>Resultado operativo aprox.</span><strong>${money(summary.operatingResult)}</strong></article>
        </section>

        <section class="dashboard-kpis" aria-label="Cobros, compras e inventario">
          <article class="metric-card"><span>Total cobrado</span><strong>${money(summary.totalCollected)}</strong></article>
          <article class="metric-card metric-card--warning"><span>Saldo por cobrar</span><strong>${money(summary.receivable)}</strong></article>
          <article class="metric-card"><span>Compras</span><strong>${money(summary.purchases)}</strong></article>
          <article class="metric-card"><span>Pagado a proveedores</span><strong>${money(summary.supplierPaid)}</strong></article>
          <article class="metric-card metric-card--warning"><span>Saldo por pagar</span><strong>${money(summary.payable)}</strong></article>
          <article class="metric-card"><span>Gastos</span><strong>${money(summary.expenses)}</strong></article>
          <article class="metric-card dashboard-inventory-card"><span>Valor inventario aprox.</span><strong>${money(summary.inventoryValue)}</strong><small>Existencia física actual × costo de compra actual.</small></article>
        </section>

        <p class="dashboard-disclaimer">“Resultado operativo aproximado” y “Valor inventario aproximado” son indicadores operativos. No representan utilidad contable formal ni balance contable.</p>

        <section class="dashboard-alerts" aria-label="Alertas accionables">
          <article class="dashboard-alert-card"><div class="dashboard-alert-card__heading"><div><span class="alert-dot alert-dot--stock"></span><h2>Existencia baja</h2></div><strong>${quantity(summary.lowStock.length)}</strong></div>${renderAlertList(summary.lowStock, 'stock')}</article>
          <article class="dashboard-alert-card"><div class="dashboard-alert-card__heading"><div><span class="alert-dot alert-dot--client"></span><h2>Clientes vencidos</h2></div><strong>${quantity(summary.overdueClients.length)}</strong></div>${renderAlertList(summary.overdueClients, 'client')}</article>
          <article class="dashboard-alert-card"><div class="dashboard-alert-card__heading"><div><span class="alert-dot alert-dot--provider"></span><h2>Proveedores vencidos</h2></div><strong>${quantity(summary.overdueProviders.length)}</strong></div>${renderAlertList(summary.overdueProviders, 'provider')}</article>
        </section>

        <div class="section-heading dashboard-module-heading"><div><h2>Accesos operativos</h2><p>Ir directo a los módulos de trabajo diario.</p></div><span class="section-badge">V1</span></div>
        <section class="dashboard-shortcuts">${quickModules.map((item) => `<a class="dashboard-shortcut" href="#${item.id}"><span>${item.icon}</span><strong>${item.label}</strong><small>${item.description}</small></a>`).join('')}</section>
      </section>`;
  }

  function expenseCategories(state) {
    const categories = state.configuraciones?.gastosCategorias;
    return Array.isArray(categories) && categories.length ? categories : ['Transporte', 'Publicidad', 'Bolsas', 'Delivery', 'Empaque'];
  }

  function isExpenseCancelled(expense) {
    return ['anulado', 'anulada', 'cancelado', 'cancelada'].includes(String(expense?.status || expense?.estado || '').toLowerCase());
  }

  function renderExpenses(module) {
    const state = store.getState();
    const categories = expenseCategories(state);
    const expenses = state.gastos
      .filter((expense) => !isExpenseCancelled(expense))
      .filter((expense) => matchesPeriod(expense, expenseMonth, expenseYear))
      .slice()
      .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
    const total = expenses.reduce((sum, expense) => sum + Math.max(0, Number(expense.amount) || 0), 0);
    const byCategory = new Set(expenses.map((expense) => expense.category)).size;

    return `
      <section class="page-panel expenses-page" aria-labelledby="pageTitle">
        <div class="page-heading expenses-heading">
          <div class="page-heading__left"><span class="page-heading__icon" aria-hidden="true">${module.icon}</span><div><h1 id="pageTitle">Gastos</h1><p>Registro operativo de gastos por fecha, categoría y método de pago.</p></div></div>
          <span class="stage-chip">V1</span>
        </div>

        <section class="expenses-summary" aria-label="Resumen de gastos">
          <article class="metric-card metric-card--accent"><span>Gastos del período</span><strong>${money(total)}</strong></article>
          <article class="metric-card"><span>Registros</span><strong>${quantity(expenses.length)}</strong></article>
          <article class="metric-card"><span>Categorías usadas</span><strong>${quantity(byCategory)}</strong></article>
          <article class="metric-card"><span>Categorías disponibles</span><strong>${quantity(categories.length)}</strong></article>
        </section>

        <div class="expenses-toolbar">
          <div class="expenses-toolbar__actions"><button class="button button--primary" type="button" data-action="add-expense">＋ Agregar gasto</button><button class="button button--secondary" type="button" data-action="manage-expense-categories">Categorías</button></div>
          <div class="expenses-toolbar__filters">${periodOptions(state, expenseMonth, expenseYear, 'expense')}</div>
        </div>

        <div class="expenses-list-heading"><div><h2>Gastos registrados</h2><p>${quantity(expenses.length)} visible${expenses.length === 1 ? '' : 's'}</p></div></div>
        <div class="expenses-list">${expenses.length ? expenses.map(renderExpenseRow).join('') : `<div class="expenses-empty"><div class="expenses-empty__mark">↘</div><h3>Sin gastos en este período</h3><p>Agrega un gasto o cambia el filtro para consultar otros períodos.</p><button class="button button--primary" type="button" data-action="add-expense">＋ Agregar gasto</button></div>`}</div>
      </section><div id="modalRoot"></div>`;
  }

  function renderExpenseRow(expense) {
    return `<article class="expense-row">
      <div class="expense-row__main"><strong>${escapeHtml(expense.category || 'Sin categoría')}</strong><span>${formatDate(expense.date || expense.createdAt)} · ${escapeHtml(expense.method || '—')}</span><small>${escapeHtml(expense.description || 'Sin descripción')}</small></div>
      <div class="expense-row__amount"><span>Monto</span><strong>${money(expense.amount)}</strong></div>
      <div class="expense-row__actions"><button class="button button--secondary button--compact" type="button" data-action="view-expense" data-expense-id="${expense.id}">Ver</button><button class="button button--primary button--compact" type="button" data-action="edit-expense" data-expense-id="${expense.id}">Editar</button></div>
    </article>`;
  }

  function openExpenseForm(expenseId = null) {
    const state = store.getState();
    const expense = expenseId ? state.gastos.find((item) => item.id === expenseId) : null;
    if (expenseId && !expense) { showToast('No se encontró el gasto.', 'error'); return; }
    const categories = expenseCategories(state);
    const selectedCategory = expense?.category || categories[0] || 'Transporte';
    const dateValue = recordDateKey(expense) || localDateKey();
    openModal(`
      <form id="expenseForm" novalidate>
        <div class="modal-header"><div><p class="modal-eyebrow">GASTOS</p><h2 id="modalTitle">${expense ? 'Editar gasto' : 'Agregar gasto'}</h2><p>El gasto afecta únicamente el tablero operativo y conserva su fecha real.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
        <div class="modal-body"><div class="fields-grid fields-grid--2">
          <label class="field-group"><span>Fecha *</span><input id="expenseDate" type="date" value="${dateValue}" max="${localDateKey()}" required></label>
          <label class="field-group"><span>Categoría *</span><select id="expenseCategory" required>${categories.map((category) => `<option value="${escapeHtml(category)}" ${category === selectedCategory ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></label>
          <label class="field-group field-group--wide"><span>Descripción *</span><input id="expenseDescription" type="text" value="${escapeHtml(expense?.description || '')}" maxlength="220" required autocomplete="off"></label>
          <label class="field-group"><span>Monto *</span><div class="money-input"><span>C$</span><input id="expenseAmount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${expense ? moneyInputValue(expense.amount) : ''}" required></div></label>
          <label class="field-group"><span>Método de pago *</span><select id="expenseMethod" required>${PAYMENT_METHODS.map((method) => `<option value="${method}" ${method === (expense?.method || 'Efectivo') ? 'selected' : ''}>${method}</option>`).join('')}</select></label>
        </div><p class="form-hint">¿Necesitas otra categoría? Cierra este formulario y usa el botón <strong>Categorías</strong> en Gastos.</p></div>
        <div class="modal-footer"><button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit">${expense ? 'Guardar cambios' : 'Guardar gasto'}</button></div>
      </form>`);

    document.getElementById('expenseForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const result = commitExpense({
        expenseId: expense?.id || null,
        date: document.getElementById('expenseDate').value,
        category: document.getElementById('expenseCategory').value,
        description: document.getElementById('expenseDescription').value,
        amount: document.getElementById('expenseAmount').value,
        method: document.getElementById('expenseMethod').value
      });
      if (!result.ok) { showToast(result.error, 'error'); return; }
      closeModal();
      renderRoute();
      showToast(expense ? 'Gasto actualizado.' : 'Gasto registrado.');
    });
  }

  function commitExpense(options) {
    const state = store.getState();
    const dateKey = String(options.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { ok: false, error: 'Selecciona una fecha válida.' };
    if (dateKey > localDateKey()) return { ok: false, error: 'La fecha del gasto no puede estar en el futuro.' };
    const category = String(options.category || '').trim();
    if (!expenseCategories(state).includes(category)) return { ok: false, error: 'Selecciona una categoría válida.' };
    const description = String(options.description || '').trim();
    if (!description) return { ok: false, error: 'Escribe una descripción.' };
    const amount = Number(options.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'El monto debe ser mayor que cero.' };
    const method = String(options.method || '');
    if (!PAYMENT_METHODS.includes(method)) return { ok: false, error: 'Selecciona un método de pago válido.' };
    const now = new Date().toISOString();
    const expenseDate = `${dateKey}T12:00:00`;
    const id = options.expenseId || uid('gas');
    const saved = store.transact((draft) => {
      if (options.expenseId) {
        const target = draft.gastos.find((item) => item.id === options.expenseId);
        if (!target) return;
        Object.assign(target, { date: expenseDate, category, description, amount, method, updatedAt: now });
      } else {
        draft.gastos.push({ id, date: expenseDate, category, description, amount, method, status: 'confirmado', createdAt: now, updatedAt: now });
      }
    });
    return saved ? { ok: true, id } : { ok: false, error: 'No se pudo guardar el gasto.' };
  }

  function openExpenseDetail(expenseId) {
    const state = store.getState();
    const expense = state.gastos.find((item) => item.id === expenseId);
    if (!expense) { showToast('No se encontró el gasto.', 'error'); return; }
    openModal(`
      <div class="modal-header"><div><p class="modal-eyebrow">GASTO</p><h2 id="modalTitle">${escapeHtml(expense.category || 'Gasto')}</h2><p>${formatDate(expense.date || expense.createdAt)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
      <div class="modal-body"><div class="sale-detail-meta"><div><span>Fecha</span><strong>${formatDate(expense.date || expense.createdAt)}</strong></div><div><span>Categoría</span><strong>${escapeHtml(expense.category || '—')}</strong></div><div><span>Método</span><strong>${escapeHtml(expense.method || '—')}</strong></div><div><span>Monto</span><strong>${money(expense.amount)}</strong></div></div><div class="expense-detail-description"><span>Descripción</span><p>${escapeHtml(expense.description || '—')}</p></div></div>
      <div class="modal-footer"><button class="button button--secondary" type="button" data-action="edit-expense" data-expense-id="${expense.id}">Editar</button><button class="button button--primary" type="button" data-action="close-modal">Cerrar</button></div>`);
  }

  function openExpenseCategories() {
    const state = store.getState();
    const categories = expenseCategories(state);
    openModal(`
      <form id="expenseCategoryForm" novalidate>
        <div class="modal-header"><div><p class="modal-eyebrow">GASTOS</p><h2 id="modalTitle">Categorías</h2><p>Agrega categorías nuevas sin reconstruir la aplicación.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
        <div class="modal-body"><div class="expense-category-list">${categories.map((category) => `<span>${escapeHtml(category)}</span>`).join('')}</div><label class="field-group"><span>Nueva categoría</span><input id="newExpenseCategory" type="text" maxlength="80" autocomplete="off" placeholder="Ej. Fotografía"></label><p class="form-hint">Las categorías existentes se conservan para no romper gastos históricos.</p></div>
        <div class="modal-footer"><button class="button button--ghost" type="button" data-action="close-modal">Cerrar</button><button class="button button--primary" type="submit">Agregar categoría</button></div>
      </form>`);
    document.getElementById('expenseCategoryForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = document.getElementById('newExpenseCategory').value.trim();
      if (!value) { showToast('Escribe el nombre de la categoría.', 'error'); return; }
      const current = store.getState();
      if (expenseCategories(current).some((category) => category.toLowerCase() === value.toLowerCase())) { showToast('Esa categoría ya existe.', 'error'); return; }
      const saved = store.transact((draft) => {
        if (!draft.configuraciones || typeof draft.configuraciones !== 'object') draft.configuraciones = {};
        if (!Array.isArray(draft.configuraciones.gastosCategorias)) draft.configuraciones.gastosCategorias = expenseCategories(current).slice();
        draft.configuraciones.gastosCategorias.push(value);
      });
      if (!saved) { showToast('No se pudo guardar la categoría.', 'error'); return; }
      closeModal();
      renderRoute();
      showToast('Categoría agregada.');
    });
  }

  function renderPlaceholder(module) {
    return `
      <section class="page-panel" aria-labelledby="pageTitle">
        <div class="page-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div>
              <h1 id="pageTitle">${module.label}</h1>
              <p>${module.description}</p>
            </div>
          </div>
          <span class="stage-chip">Preparado</span>
        </div>
        <div class="placeholder">
          <div class="placeholder__mark" aria-hidden="true">${module.icon}</div>
          <h2>Estructura lista</h2>
          <p>Este módulo ya forma parte de la navegación y queda preparado para recibir su lógica operativa en una etapa posterior, sin datos ficticios permanentes.</p>
        </div>
      </section>
    `;
  }

  function renderConfiguration(module) {
    resetIdentityLogoDraft();
    const state = store.getState();
    const identity = normalizeBusinessIdentity(state.configuraciones?.identidad);
    const identityDisplayName = businessIdentityDisplayName(identity);
    const backup = state.configuraciones?.respaldo || {};
    const dangerBackupReady = hasFreshDangerBackupAuthorization();
    const dangerPhase = dangerBackupReady ? dangerDeleteFlow.phase : 'backup-required';
    const dangerDeleting = dangerBackupReady && dangerPhase === 'deleting-operational-data';
    const dangerCompleted = dangerBackupReady && dangerPhase === 'operational-completed';
    const pwaAvailable = 'serviceWorker' in navigator;
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
    const swStatusLabel = serviceWorkerStatusLabel();
    const mainLogoSrc = identity.mainLogo?.dataUrl || PROMETEO_LOGO_PATH;
    const horizontalLogoSrc = businessIdentityHorizontalLogoSrc(identity);
    return `
      <section class="page-panel config-page" aria-labelledby="pageTitle">
        <div class="page-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div>
              <h1 id="pageTitle">Configuración</h1>
              <p>Identidad comercial, respaldo local y estado de instalación de la aplicación.</p>
            </div>
          </div>
          <span class="stage-chip">V1</span>
        </div>
        <div class="config-grid">
          <article class="info-card config-identity-card">
            <div class="config-card-heading">
              <div>
                <h2>Identidad del negocio</h2>
                <p>Fuente única de la información comercial visible en cabecera, Inicio, catálogo, PDF y demás superficies de marca.</p>
              </div>
              <span class="status-pill status-pill--neutral">Central</span>
            </div>

            <form id="businessIdentityForm" class="business-identity-form" novalidate>
              <div class="identity-settings-layout">
                <div class="fields-grid fields-grid--2 identity-fields">
                  <label class="field-group field-group--wide">
                    <span>Nombre de la aplicación *</span>
                    <input id="identityAppName" type="text" value="${escapeHtml(identity.appName)}" maxlength="120" required autocomplete="off">
                  </label>
                  <label class="field-group field-group--wide">
                    <span>Nombre comercial del negocio</span>
                    <input id="identityBusinessName" type="text" value="${escapeHtml(identity.businessName)}" maxlength="140" autocomplete="organization">
                  </label>
                  <label class="field-group">
                    <span>Nombre del propietario</span>
                    <input id="identityOwnerName" type="text" value="${escapeHtml(identity.ownerName)}" maxlength="140" autocomplete="name">
                  </label>
                  <label class="field-group">
                    <span>Eslogan</span>
                    <input id="identitySlogan" type="text" value="${escapeHtml(identity.slogan)}" maxlength="180" autocomplete="off">
                  </label>
                  <label class="field-group">
                    <span>Teléfono</span>
                    <input id="identityPhone" type="tel" value="${escapeHtml(identity.phone)}" maxlength="50" inputmode="tel" autocomplete="tel">
                  </label>
                  <label class="field-group">
                    <span>WhatsApp</span>
                    <input id="identityWhatsapp" type="tel" value="${escapeHtml(identity.whatsapp)}" maxlength="50" inputmode="tel" autocomplete="off">
                  </label>
                  <label class="field-group field-group--wide">
                    <span>Correo</span>
                    <input id="identityEmail" type="email" value="${escapeHtml(identity.email)}" maxlength="180" autocomplete="email">
                  </label>
                  <label class="field-group field-group--wide">
                    <span>Dirección</span>
                    <textarea id="identityAddress" rows="3" maxlength="400">${escapeHtml(identity.address)}</textarea>
                  </label>
                </div>

                <aside class="business-identity-preview" aria-label="Vista previa de identidad del negocio">
                  <span class="business-identity-preview__eyebrow">VISTA PREVIA</span>
                  <div class="business-identity-preview__logo-wrap">
                    <img id="identityBusinessPreviewLogo" data-business-logo="true" src="${mainLogoSrc}" alt="Vista previa del logotipo principal">
                  </div>
                  <strong id="identityPreviewBusinessName">${escapeHtml(identityDisplayName)}</strong>
                  <p id="identityPreviewSlogan" ${identity.slogan ? '' : 'hidden'}>${escapeHtml(identity.slogan)}</p>
                  <small id="identityPreviewOwner" ${identity.ownerName ? '' : 'hidden'}>${identity.ownerName ? `Propietario: ${escapeHtml(identity.ownerName)}` : ''}</small>
                </aside>
              </div>

              <div class="identity-logo-grid">
                <section class="identity-logo-card">
                  <div class="identity-logo-card__heading">
                    <div><h3>Logotipo principal</h3><p>Usado como identidad principal en las siguientes etapas.</p></div>
                    <span id="identityMainLogoStatus" class="identity-logo-status">${identity.mainLogo ? 'Personalizado guardado' : 'Fallback PROMETEO activo'}</span>
                  </div>
                  <div class="identity-logo-preview identity-logo-preview--main">
                    <img id="identityMainLogoPreview" data-business-logo="true" src="${mainLogoSrc}" alt="Logotipo principal">
                  </div>
                  <div class="identity-logo-actions">
                    <label class="button button--secondary file-button">
                      ${identity.mainLogo ? 'Reemplazar logo' : 'Cargar logo'}
                      <input id="identityMainLogoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                    </label>
                    <button id="identityMainLogoRemove" class="text-button text-button--danger" type="button" data-action="remove-identity-logo" data-logo-kind="main" ${identity.mainLogo ? '' : 'hidden'}>Eliminar personalizado</button>
                  </div>
                </section>

                <section class="identity-logo-card">
                  <div class="identity-logo-card__heading">
                    <div><h3>Logotipo horizontal <small>(opcional)</small></h3><p>Alternativa para encabezados y espacios anchos.</p></div>
                    <span id="identityHorizontalLogoStatus" class="identity-logo-status">${identity.horizontalLogo ? 'Personalizado guardado' : (identity.mainLogo ? 'Fallback logo principal activo' : 'Fallback PROMETEO activo')}</span>
                  </div>
                  <div class="identity-logo-preview identity-logo-preview--horizontal">
                    <img id="identityHorizontalLogoPreview" data-business-logo="true" src="${horizontalLogoSrc}" alt="Logotipo horizontal">
                  </div>
                  <div class="identity-logo-actions">
                    <label class="button button--secondary file-button">
                      ${identity.horizontalLogo ? 'Reemplazar logo' : 'Cargar logo'}
                      <input id="identityHorizontalLogoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
                    </label>
                    <button id="identityHorizontalLogoRemove" class="text-button text-button--danger" type="button" data-action="remove-identity-logo" data-logo-kind="horizontal" ${identity.horizontalLogo ? '' : 'hidden'}>Eliminar personalizado</button>
                  </div>
                </section>
              </div>

              <p class="identity-logo-help">Formatos permitidos: PNG, JPG/JPEG y WebP. Las imágenes se optimizan localmente para conservar proporción, evitar deformación y reducir el riesgo de saturar el almacenamiento.</p>
              <div class="identity-restore-row">
                <div><strong>Identidad PROMETEO</strong><small>Restaura únicamente la identidad visual/comercial base. No modifica datos operativos, fotos ni PWA.</small></div>
                <button class="button button--secondary" type="button" data-action="restore-prometeo-identity">Restaurar identidad PROMETEO</button>
              </div>
              <div class="identity-save-row">
                <span>Versión ${APP.version} · Persistencia local existente</span>
                <button id="saveBusinessIdentityButton" class="button button--primary" type="button" data-action="save-business-identity">Guardar identidad</button>
              </div>
            </form>
          </article>

          <article class="info-card config-backup-card">
            <div class="config-card-heading"><div><h2>Respaldo</h2><p>Exporta o restaura una copia completa, incluyendo fotos.</p></div><span class="config-status-dot" aria-hidden="true"></span></div>
            <div class="backup-actions">
              <button class="button button--primary" type="button" data-action="export-backup">Exportar respaldo JSON</button>
              <button class="button button--secondary" type="button" data-action="choose-backup-import">Importar respaldo JSON</button>
              <input id="backupImportInput" class="visually-hidden" type="file" accept="application/json,.json" aria-label="Seleccionar respaldo JSON">
            </div>
            <dl class="info-list backup-info-list">
              <div class="info-row"><dt>Último respaldo exportado</dt><dd>${backup.lastExportAt ? formatDate(backup.lastExportAt, true) : 'Nunca'}</dd></div>
              <div class="info-row"><dt>Última importación exitosa</dt><dd>${backup.lastImportAt ? formatDate(backup.lastImportAt, true) : 'Nunca'}</dd></div>
            </dl>
            <p class="config-note">La importación valida estructura y versión antes de reemplazar los datos actuales. Un archivo inválido no modifica la app.</p>
          </article>
          <article class="info-card config-pwa-card">
            <div class="config-card-heading"><div><h2>PWA</h2><p>Instalación, trabajo local y actualización segura.</p></div><span class="status-pill status-pill--${standalone ? 'success' : 'neutral'}">${standalone ? 'Instalada' : (pwaAvailable ? 'Disponible' : 'No compatible')}</span></div>
            <dl class="info-list">
              <div class="info-row"><dt>Modo</dt><dd>${standalone ? 'Standalone' : 'Navegador'}</dd></div>
              <div class="info-row"><dt>Service Worker</dt><dd id="pwaSwStatus">${escapeHtml(swStatusLabel)}</dd></div>
              <div class="info-row"><dt>Conexión</dt><dd id="pwaConnectionStatus">${navigator.onLine ? 'En línea' : 'Sin conexión'}</dd></div>
            </dl>
            <div class="backup-actions">
              <button class="button button--primary" type="button" data-action="install-pwa" ${standalone ? 'disabled' : ''}>${standalone ? 'App instalada' : 'Instalar app'}</button>
              <button class="button button--secondary" type="button" data-action="check-pwa-update" ${pwaAvailable ? '' : 'disabled'}>Buscar actualización</button>
            </div>
            <p class="config-note">Los módulos principales funcionan con datos locales. La caché PWA se renueva por versión y elimina cachés antiguas.</p>
          </article>

          <article class="info-card config-danger-card" aria-labelledby="dangerZoneTitle" ${dangerDeleteFlow.busy ? 'aria-busy="true"' : ''}>
            <div class="config-card-heading config-danger-heading">
              <div>
                <span class="config-danger-eyebrow">ZONA DE PELIGRO</span>
                <h2 id="dangerZoneTitle">Borrar datos operativos</h2>
                <p>El borrado elimina únicamente datos operativos de localStorage y las fotografías de productos en IndexedDB. La Identidad del negocio, los logotipos, las demás configuraciones y la instalación PWA se conservan intactas.</p>
              </div>
              <span class="status-pill ${dangerCompleted || dangerDeleting || dangerBackupReady ? 'status-pill--success' : 'status-pill--danger'}">${dangerCompleted ? 'Borrado completo' : (dangerDeleting ? 'Procesando…' : (dangerBackupReady ? 'Respaldo listo' : 'Respaldo requerido'))}</span>
            </div>

            <ol class="danger-flow-steps" aria-label="Estado del flujo de borrado seguro">
              <li class="${dangerBackupReady ? 'is-done' : 'is-active'}"><span>1</span><div><strong>${dangerBackupReady ? 'Respaldo completado' : 'Respaldo requerido'}</strong><small>Debe pertenecer a esta operación.</small></div></li>
              <li class="${['final-confirmation', 'deleting-operational-data', 'operational-completed'].includes(dangerPhase) ? 'is-done' : (dangerBackupReady ? 'is-active' : 'is-locked')}"><span>2</span><div><strong>${['final-confirmation', 'deleting-operational-data', 'operational-completed'].includes(dangerPhase) ? 'BORRAR validado' : 'BORRAR pendiente'}</strong><small>Coincidencia exacta, sin espacios.</small></div></li>
              <li class="${['deleting-operational-data', 'operational-completed'].includes(dangerPhase) ? 'is-done' : (dangerPhase === 'final-confirmation' ? 'is-active' : 'is-locked')}"><span>3</span><div><strong>${['deleting-operational-data', 'operational-completed'].includes(dangerPhase) ? 'Confirmación completada' : 'Confirmación final'}</strong><small>Una última decisión explícita.</small></div></li>
              <li class="${dangerCompleted ? 'is-done is-active' : (dangerDeleting ? 'is-active' : 'is-locked')}"><span>4</span><div><strong>${dangerCompleted ? 'Datos operativos vacíos' : (dangerDeleting ? 'Borrando y verificando' : 'Borrado operativo')}</strong><small>${dangerCompleted ? 'Las 12 colecciones y productPhotos fueron verificados vacíos.' : (dangerDeleting ? 'Coordinando localStorage + IndexedDB y verificando el resultado antes de anunciar éxito.' : 'Solo se habilita después de completar respaldo, BORRAR y confirmación final.')}</small></div></li>
            </ol>

            <div class="danger-backup-panel">
              <div class="danger-backup-copy">
                <strong>Respaldo JSON obligatorio y fresco</strong>
                <p>Solo habilita el flujo un respaldo generado desde esta misma operación. Un respaldo anterior, otra sesión o un estado visual obsoleto no autorizan continuar.</p>
                ${dangerBackupReady
                  ? `<small class="danger-backup-success">Autorización temporal activa · ${formatDate(dangerBackupAuthorization.exportedAt, true)} · ${quantity(dangerBackupAuthorization.photoCount)} foto${dangerBackupAuthorization.photoCount === 1 ? '' : 's'} incluida${dangerBackupAuthorization.photoCount === 1 ? '' : 's'}.</small>`
                  : '<small>La autorización se invalida al salir de Configuración, recargar la app o si el respaldo vigente deja de coincidir con esta operación.</small>'}
              </div>
              <div class="danger-backup-actions">
                <button class="button button--danger-safe" type="button" data-action="export-danger-backup" ${dangerDeleteFlow.busy || dangerCompleted ? 'disabled' : ''}>Generar respaldo obligatorio</button>
                <button class="button ${dangerBackupReady ? 'button--danger-safe' : 'button--secondary'}" type="button" data-action="open-danger-delete-warning" ${dangerBackupReady && !dangerDeleteFlow.busy && !dangerCompleted ? '' : 'disabled aria-disabled="true"'}>${dangerCompleted ? 'Borrado completado' : 'Continuar al borrado'}</button>
              </div>
            </div>
            <p class="config-danger-note">Flujo final endurecido: respaldo fresco obligatorio, borrado operativo verificado y restauración JSON con fotografías, preservando Identidad del negocio y PWA.</p>
          </article>
        </div>
        <div id="modalRoot"></div>
      </section>
    `;
  }

  function refreshBusinessIdentityPreview() {
    const appNameInput = document.getElementById('identityAppName');
    const businessNameInput = document.getElementById('identityBusinessName');
    const ownerInput = document.getElementById('identityOwnerName');
    const sloganInput = document.getElementById('identitySlogan');
    const businessName = String(businessNameInput?.value || '').trim() || String(appNameInput?.value || '').trim() || APP.name;
    const ownerName = String(ownerInput?.value || '').trim();
    const slogan = String(sloganInput?.value || '').trim();
    const nameNode = document.getElementById('identityPreviewBusinessName');
    const ownerNode = document.getElementById('identityPreviewOwner');
    const sloganNode = document.getElementById('identityPreviewSlogan');
    if (nameNode) nameNode.textContent = businessName;
    if (sloganNode) {
      sloganNode.textContent = slogan;
      sloganNode.hidden = !slogan;
    }
    if (ownerNode) {
      ownerNode.textContent = ownerName ? `Propietario: ${ownerName}` : '';
      ownerNode.hidden = !ownerName;
    }
  }

  function setIdentityLogoPreview(kind, src, statusText, showRemove) {
    const prefix = kind === 'horizontal' ? 'Horizontal' : 'Main';
    const preview = document.getElementById(`identity${prefix}LogoPreview`);
    const status = document.getElementById(`identity${prefix}LogoStatus`);
    const remove = document.getElementById(`identity${prefix}LogoRemove`);
    if (preview) setBusinessLogoSource(preview, src);
    if (status) status.textContent = statusText;
    if (remove) remove.hidden = !showRemove;
    if (kind === 'main') {
      const businessPreview = document.getElementById('identityBusinessPreviewLogo');
      if (businessPreview) setBusinessLogoSource(businessPreview, src);
    }
  }

  async function imageBitmapFromFile(file) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(file);
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  async function optimizeIdentityLogo(file, kind) {
    if (!IDENTITY_ALLOWED_IMAGE_TYPES.includes(String(file.type || '').toLowerCase())) throw new Error('Formato no permitido. Usa PNG, JPG/JPEG o WebP.');
    if (!file.size || file.size > IDENTITY_LOGO_MAX_INPUT_BYTES) throw new Error('El logotipo no debe superar 8 MB.');
    const image = await imageBitmapFromFile(file);
    const naturalWidth = Math.max(1, Number(image.width || image.naturalWidth) || 1);
    const naturalHeight = Math.max(1, Number(image.height || image.naturalHeight) || 1);
    const maxWidth = kind === 'horizontal' ? 1800 : 1400;
    const maxHeight = kind === 'horizontal' ? 900 : 1400;
    const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('No se pudo preparar el logotipo.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);
    if (typeof image.close === 'function') image.close();

    let output = null;
    for (const quality of [0.92, 0.84, 0.76, 0.68]) {
      output = await canvasToBlob(canvas, 'image/webp', quality);
      if (output && output.size <= IDENTITY_LOGO_MAX_STORED_BYTES) break;
    }
    if (!output) output = await canvasToBlob(canvas, 'image/png');
    if (!output || output.size > IDENTITY_LOGO_MAX_STORED_BYTES) throw new Error('La imagen sigue siendo demasiado pesada después de optimizarla. Prueba con un archivo más liviano.');
    return {
      dataUrl: await blobToDataUrl(output),
      type: output.type || 'image/webp',
      name: String(file.name || 'logo').slice(0, 180),
      size: output.size,
      updatedAt: new Date().toISOString()
    };
  }

  async function stageIdentityLogoFromInput(kind, input) {
    const file = input?.files?.[0];
    if (!file) return;
    identityLogoProcessing += 1;
    const prefix = kind === 'horizontal' ? 'Horizontal' : 'Main';
    const status = document.getElementById(`identity${prefix}LogoStatus`);
    if (status) status.textContent = 'Procesando…';
    try {
      const optimized = await optimizeIdentityLogo(file, kind);
      identityLogoDraft[kind] = optimized;
      setIdentityLogoPreview(kind, optimized.dataUrl, 'Cambio listo para guardar', true);
      showToast(kind === 'main' ? 'Logotipo principal listo para guardar.' : 'Logotipo horizontal listo para guardar.');
    } catch (error) {
      console.error('[DOREN] No se pudo preparar el logotipo.', error);
      const current = normalizeBusinessIdentity(store.getState().configuraciones?.identidad);
      const record = kind === 'main' ? current.mainLogo : current.horizontalLogo;
      const fallbackSrc = kind === 'horizontal' ? businessIdentityHorizontalLogoSrc(current) : businessIdentityMainLogoSrc(current);
      const fallbackStatus = record ? 'Personalizado guardado' : (kind === 'horizontal' && current.mainLogo ? 'Fallback logo principal activo' : 'Fallback PROMETEO activo');
      setIdentityLogoPreview(kind, record?.dataUrl || fallbackSrc, fallbackStatus, Boolean(record));
      showToast(error?.message || 'No se pudo procesar el logotipo.', 'error');
    } finally {
      identityLogoProcessing = Math.max(0, identityLogoProcessing - 1);
      if (input) input.value = '';
    }
  }

  function stageIdentityLogoRemoval(kind) {
    if (!['main', 'horizontal'].includes(kind)) return;
    identityLogoDraft[kind] = null;
    const current = getBusinessIdentity();
    const stagedMain = identityLogoDraft.main === undefined ? current.mainLogo : identityLogoDraft.main;
    const effectiveMainSrc = stagedMain?.dataUrl || PROMETEO_LOGO_PATH;
    if (kind === 'horizontal') {
      setIdentityLogoPreview(kind, effectiveMainSrc, stagedMain ? 'Fallback logo principal al guardar' : 'Fallback PROMETEO al guardar', false);
      showToast(stagedMain ? 'Se usará el logo principal como fallback al guardar.' : 'Se usará el logo PROMETEO como fallback al guardar.');
      return;
    }
    setIdentityLogoPreview(kind, PROMETEO_LOGO_PATH, 'Fallback PROMETEO al guardar', false);
    showToast('Se usará el logo PROMETEO al guardar.');
  }

  function identityValue(id) {
    return String(document.getElementById(id)?.value || '').trim();
  }

  async function saveBusinessIdentity(button) {
    const form = document.getElementById('businessIdentityForm');
    if (!form) return;
    if (identityLogoProcessing > 0) {
      showToast('Espera a que termine de procesarse el logotipo.', 'error');
      return;
    }
    if (!form.reportValidity()) return;
    const originalText = button?.textContent || 'Guardar identidad';
    if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
    try {
      const current = normalizeBusinessIdentity(store.getState().configuraciones?.identidad);
      const nextIdentity = normalizeBusinessIdentity({
        appName: identityValue('identityAppName'),
        businessName: identityValue('identityBusinessName'),
        ownerName: identityValue('identityOwnerName'),
        slogan: identityValue('identitySlogan'),
        phone: identityValue('identityPhone'),
        whatsapp: identityValue('identityWhatsapp'),
        email: identityValue('identityEmail'),
        address: identityValue('identityAddress'),
        mainLogo: identityLogoDraft.main === undefined ? current.mainLogo : identityLogoDraft.main,
        horizontalLogo: identityLogoDraft.horizontal === undefined ? current.horizontalLogo : identityLogoDraft.horizontal,
        updatedAt: new Date().toISOString()
      });
      const saved = store.transact((draft) => {
        draft.configuraciones = draft.configuraciones || {};
        draft.configuraciones.identidad = nextIdentity;
      });
      if (!saved) throw new Error('No se pudo guardar la identidad en el almacenamiento local.');
      renderRoute();
      showToast('Identidad del negocio guardada correctamente.');
    } catch (error) {
      console.error('[DOREN] No se pudo guardar la identidad del negocio.', error);
      showToast(error?.message || 'No se pudo guardar la identidad del negocio.', 'error');
    } finally {
      if (button && document.body.contains(button)) { button.disabled = false; button.textContent = originalText; }
    }
  }

  function restorePrometeoIdentity(button) {
    const confirmed = window.confirm('¿Restaurar la identidad visual/comercial base de PROMETEO?\n\nEsta acción solo cambia la identidad del negocio. Inventario, Ventas, Compras, clientes, históricos, fotos, IndexedDB y PWA permanecerán intactos.');
    if (!confirmed) return;
    const originalText = button?.textContent || 'Restaurar identidad PROMETEO';
    if (button) { button.disabled = true; button.textContent = 'Restaurando…'; }
    try {
      const restored = createDefaultBusinessIdentity();
      restored.updatedAt = new Date().toISOString();
      const saved = store.transact((draft) => {
        draft.configuraciones = draft.configuraciones || {};
        draft.configuraciones.identidad = restored;
      });
      if (!saved) throw new Error('No se pudo restaurar la identidad PROMETEO.');
      resetIdentityLogoDraft();
      renderRoute();
      showToast('Identidad PROMETEO restaurada. Los datos operativos permanecen intactos.');
    } catch (error) {
      console.error('[PROMETEO] No se pudo restaurar la identidad PROMETEO.', error);
      showToast(error?.message || 'No se pudo restaurar la identidad PROMETEO.', 'error');
    } finally {
      if (button && document.body.contains(button)) { button.disabled = false; button.textContent = originalText; }
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer una foto'));
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!match || !match[1].startsWith('image/')) throw new Error('Foto codificada inválida');
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: match[1] });
  }

  function resetDangerDeleteFlow(phase = 'backup-required') {
    dangerDeleteFlow = {
      phase,
      operationId: null,
      keywordValid: false,
      busy: false,
      preparedAt: null,
      completedAt: null
    };
  }

  function resetDangerBackupAuthorization() {
    dangerBackupAuthorization = null;
    resetDangerDeleteFlow();
  }

  function startDangerBackupAuthorization() {
    const operationId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    resetDangerDeleteFlow();
    dangerBackupAuthorization = { operationId, status: 'pending', exportedAt: null, photoCount: 0, filename: '' };
    return operationId;
  }

  function hasFreshDangerBackupAuthorization(operationId = null) {
    const authorization = dangerBackupAuthorization;
    if (!authorization || authorization.status !== 'authorized' || !authorization.operationId || !authorization.exportedAt) return false;
    if (operationId && authorization.operationId !== operationId) return false;
    const persistedLastExportAt = store.getState().configuraciones?.respaldo?.lastExportAt || null;
    return persistedLastExportAt === authorization.exportedAt;
  }

  function markDangerDeleteModal() {
    const modal = modalRoot()?.querySelector('.modal');
    if (modal) modal.dataset.dangerDeleteModal = 'true';
  }

  function setDangerDeleteBusy(isBusy) {
    dangerDeleteFlow.busy = Boolean(isBusy);
    const modal = modalRoot()?.querySelector('[data-danger-delete-modal="true"]');
    if (!modal) return;
    modal.setAttribute('aria-busy', dangerDeleteFlow.busy ? 'true' : 'false');
    modal.querySelectorAll('button, input').forEach((control) => {
      control.disabled = dangerDeleteFlow.busy;
    });
  }

  function ensureFreshDangerBackupOrReset(operationId = null) {
    if (hasFreshDangerBackupAuthorization(operationId)) return true;
    resetDangerBackupAuthorization();
    closeModal(true);
    if (safeRoute() === 'configuracion') renderRoute();
    showToast('Debes generar un respaldo JSON nuevo desde esta operación antes de continuar.', 'error');
    return false;
  }

  function openDangerDeleteWarning() {
    if (dangerDeleteFlow.busy || dangerDeleteFlow.phase !== 'backup-completed') return;
    if (!ensureFreshDangerBackupOrReset(dangerDeleteFlow.operationId || null)) return;
    const operationId = dangerBackupAuthorization.operationId;
    dangerDeleteFlow = {
      phase: 'keyword',
      operationId,
      keywordValid: false,
      busy: false,
      preparedAt: null,
      completedAt: null
    };
    openModal(`
      <div class="modal-header">
        <div><p class="modal-eyebrow danger-modal-eyebrow">BORRADO SEGURO DE DATOS OPERATIVOS</p><h2 id="modalTitle">Advertencia antes de continuar</h2><p>Este flujo ejecuta el borrado real de los datos operativos guardados en localStorage y de las fotografías de productos en IndexedDB, después de completar todas las confirmaciones.</p></div>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body danger-confirm-body">
        <section class="danger-warning-box" aria-label="Datos operativos que se eliminarán">
          <strong>Al confirmar el paso final se vaciarán las 12 colecciones operativas del negocio en localStorage y el store productPhotos de IndexedDB.</strong>
          <p>Cancelar, cerrar este modal, salir del flujo o volver atrás mantiene todo intacto.</p>
        </section>
        <section class="danger-preserved-box" aria-label="Datos que se conservarán">
          <h3>Se conservarán intactos</h3>
          <div class="danger-preserved-grid">
            <span>Identidad del negocio</span><span>Nombre de la app</span><span>Nombre comercial</span><span>Propietario</span>
            <span>Eslogan</span><span>Teléfono</span><span>WhatsApp</span><span>Correo</span>
            <span>Dirección</span><span>Logotipos</span><span>PWA e instalación</span><span>Actualizaciones</span>
          </div>
        </section>
        <label class="field-group danger-keyword-field" for="dangerDeleteKeyword">
          <span>Para continuar, escribe exactamente <strong>BORRAR</strong></span>
          <input id="dangerDeleteKeyword" type="text" value="" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" maxlength="40" aria-describedby="dangerDeleteKeywordStatus">
        </label>
        <p id="dangerDeleteKeywordStatus" class="danger-keyword-status" aria-live="polite">BORRAR pendiente.</p>
      </div>
      <div class="modal-footer danger-modal-footer">
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button id="dangerDeleteReviewButton" class="button button--danger-safe" type="button" data-action="review-danger-delete" disabled aria-disabled="true">Continuar</button>
      </div>`, 'modal--medium modal--danger-confirm');
    markDangerDeleteModal();
    const input = document.getElementById('dangerDeleteKeyword');
    if (input) setTimeout(() => input.focus(), 0);
  }

  function reviewDangerDeleteConfirmation() {
    if (dangerDeleteFlow.busy || dangerDeleteFlow.phase !== 'keyword') return;
    const operationId = dangerDeleteFlow.operationId;
    if (!ensureFreshDangerBackupOrReset(operationId)) return;
    const keyword = document.getElementById('dangerDeleteKeyword')?.value ?? '';
    if (keyword !== 'BORRAR' || !dangerDeleteFlow.keywordValid) {
      showToast('Debes escribir BORRAR exactamente para continuar.', 'error');
      return;
    }
    dangerDeleteFlow.phase = 'final-confirmation';
    openModal(`
      <div class="modal-header">
        <div><p class="modal-eyebrow danger-modal-eyebrow">CONFIRMACIÓN FINAL</p><h2 id="modalTitle">Confirmar borrado de datos operativos</h2><p>La palabra BORRAR fue validada correctamente.</p></div>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body danger-confirm-body">
        <section class="danger-final-box">
          <strong>¿Deseas borrar ahora todos los datos operativos?</strong>
          <p>Se vaciarán productos, variantes, clientes, ventas, cobros, proveedores, compras, pagos a proveedores, apartados, operaciones postventa, gastos y movimientos de inventario, junto con las fotografías de productos almacenadas en IndexedDB. La Identidad del negocio, sus logotipos, las demás configuraciones y la PWA se conservarán intactas.</p>
          <p><strong>Verificación:</strong> el éxito solo se confirmará si las 12 colecciones y productPhotos quedan vacíos y Configuración/Identidad permanece intacta.</p>
        </section>
        <p class="danger-operation-id">Respaldo validado para esta operación · ${escapeHtml(operationId)}</p>
      </div>
      <div class="modal-footer danger-modal-footer">
        <button class="button button--secondary" type="button" data-action="close-modal">Cancelar</button>
        <button class="button button--danger-safe" type="button" data-action="prepare-danger-delete">Borrar datos operativos</button>
      </div>`, 'modal--medium modal--danger-confirm');
    markDangerDeleteModal();
  }

  function operationalCollectionsAreEmpty(state) {
    return Boolean(state) && collections.every((name) => Array.isArray(state[name]) && state[name].length === 0);
  }

  async function prepareDangerDeleteFlow() {
    if (dangerDeleteFlow.busy || dangerDeleteFlow.phase !== 'final-confirmation') return;
    const operationId = dangerDeleteFlow.operationId;
    if (!ensureFreshDangerBackupOrReset(operationId)) return;

    const before = store.readRaw();
    if (!before || typeof before !== 'object' || Array.isArray(before)) {
      console.error('[PROMETEO] Borrado operativo cancelado: el estado principal no es válido.');
      showToast('No se pudo validar el estado local antes del borrado.', 'error');
      return;
    }

    const preservedConfigurations = JSON.stringify(before.configuraciones || {});
    const originalState = JSON.parse(JSON.stringify(before));
    const nextState = JSON.parse(JSON.stringify(before));
    collections.forEach((name) => { nextState[name] = []; });

    dangerDeleteFlow.phase = 'deleting-operational-data';
    dangerDeleteFlow.preparedAt = new Date().toISOString();
    dangerDeleteFlow.keywordValid = true;
    setDangerDeleteBusy(true);

    const processingCopy = modalRoot()?.querySelector('.danger-final-box p');
    if (processingCopy) processingCopy.textContent = 'Procesando borrado operativo de localStorage + IndexedDB y verificando persistencia…';

    let localStoragePersisted = false;
    let photosCleared = false;
    let originalPhotoEntries = null;
    try {
      originalPhotoEntries = await photoStore.entries();

      localStoragePersisted = store.writeRaw(nextState);
      if (!localStoragePersisted) throw new Error('localStorage rechazó la persistencia del estado operativo vacío.');

      await photoStore.clear();
      photosCleared = true;

      const verified = store.readRaw();
      if (!verified || !operationalCollectionsAreEmpty(verified)) {
        throw new Error('La verificación posterior detectó colecciones operativas no vacías o inválidas.');
      }
      if (JSON.stringify(verified.configuraciones || {}) !== preservedConfigurations) {
        throw new Error('La verificación detectó una alteración inesperada en Configuración o Identidad del negocio.');
      }

      const remainingPhotos = await photoStore.count();
      if (remainingPhotos !== 0) {
        throw new Error(`La verificación de IndexedDB detectó ${remainingPhotos} fotografía(s) residual(es) en productPhotos.`);
      }

      dangerDeleteFlow.phase = 'operational-completed';
      dangerDeleteFlow.completedAt = new Date().toISOString();
      dangerDeleteFlow.busy = false;

      try {
        sessionStorage.setItem(DANGER_DELETE_COMPLETED_SESSION_KEY, JSON.stringify({
          operationId,
          completedAt: dangerDeleteFlow.completedAt
        }));
      } catch (error) {
        console.warn('[PROMETEO] El borrado terminó correctamente, pero no se pudo guardar el aviso temporal posterior a la recarga.', error);
      }

      closeModal(true);
      window.setTimeout(() => window.location.reload(), 140);
    } catch (error) {
      let rollbackFailed = false;

      if (localStoragePersisted) {
        const rollbackOk = store.writeRaw(originalState);
        if (!rollbackOk) {
          rollbackFailed = true;
          console.error('[PROMETEO] Falló el intento de restaurar localStorage tras el error de borrado.');
        }
      }

      if (photosCleared && Array.isArray(originalPhotoEntries)) {
        try {
          await photoStore.replaceAll(originalPhotoEntries);
        } catch (rollbackError) {
          rollbackFailed = true;
          console.error('[PROMETEO] Falló el intento de restaurar productPhotos tras el error de borrado.', rollbackError);
        }
      }

      console.error('[PROMETEO] No se pudo completar el borrado operativo coordinado de localStorage + IndexedDB.', error);
      dangerDeleteFlow.phase = 'final-confirmation';
      dangerDeleteFlow.busy = false;
      setDangerDeleteBusy(false);
      showToast(
        rollbackFailed
          ? 'El borrado no pudo completarse y la restauración automática también tuvo una falla. Revisa la consola y conserva el respaldo JSON.'
          : 'No se pudo completar el borrado operativo. El proceso no se marcó como exitoso y se restauró el estado previo.',
        'error'
      );
    }
  }

  function downloadBlob(blob, filename) {
    if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('El archivo de respaldo está vacío.');
    const safeFilename = String(filename || '').trim();
    if (!safeFilename) throw new Error('No se pudo preparar el nombre del archivo de respaldo.');
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  }

  function backupFilename(date = new Date()) {
    const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    return `PROMETEO_Respaldo_${stamp}.json`;
  }

  async function buildBackupArtifact(exportedAt) {
    const data = store.getState();
    data.configuraciones = data.configuraciones || {};
    data.configuraciones.identidad = normalizeBusinessIdentity(data.configuraciones.identidad);
    data.configuraciones.respaldo = data.configuraciones.respaldo || {};
    data.configuraciones.respaldo.lastExportAt = exportedAt;

    const photoEntries = await photoStore.entries();
    const photos = [];
    for (const [productId, blob] of photoEntries) {
      if (!(blob instanceof Blob)) throw new Error(`La fotografía local de ${productId} no pudo leerse como archivo.`);
      const dataUrl = await blobToDataUrl(blob);
      if (!dataUrl.startsWith('data:image/')) throw new Error(`La fotografía local de ${productId} no pudo codificarse correctamente.`);
      photos.push({
        productId,
        type: blob.type || 'image/jpeg',
        size: blob.size,
        dataUrl
      });
    }

    const payload = {
      backup: {
        format: 'DOREN_FASHION_STYLE_BACKUP',
        formatVersion: 1,
        appName: APP.name,
        appVersion: APP.version,
        schemaVersion: APP.schemaVersion,
        identitySchemaVersion: 1,
        exportedAt
      },
      data,
      photos
    };
    const json = JSON.stringify(payload, null, 2);
    if (!json || json.length < 2) throw new Error('No se pudo construir el contenido JSON del respaldo.');
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    if (!blob.size) throw new Error('El archivo JSON resultante está vacío.');
    return {
      blob,
      exportedAt,
      filename: backupFilename(new Date(exportedAt)),
      photoCount: photos.length
    };
  }

  async function exportBackup(button, options = {}) {
    const dangerOperation = options.dangerOperation === true;
    const operationId = dangerOperation ? startDangerBackupAuthorization() : null;
    const originalText = button?.textContent || '';
    if (button) { button.disabled = true; button.textContent = 'Preparando respaldo…'; }
    try {
      const exportedAt = new Date().toISOString();
      const artifact = await buildBackupArtifact(exportedAt);
      downloadBlob(artifact.blob, artifact.filename);

      const saved = store.transact((draft) => {
        draft.configuraciones = draft.configuraciones || {};
        draft.configuraciones.respaldo = draft.configuraciones.respaldo || {};
        draft.configuraciones.respaldo.lastExportAt = exportedAt;
      });
      if (!saved) throw new Error('El respaldo se generó, pero no se pudo registrar su finalización.');

      if (dangerOperation && dangerBackupAuthorization?.operationId === operationId) {
        dangerBackupAuthorization = {
          operationId,
          status: 'authorized',
          exportedAt: artifact.exportedAt,
          photoCount: artifact.photoCount,
          filename: artifact.filename
        };
        dangerDeleteFlow = {
          phase: 'backup-completed',
          operationId,
          keywordValid: false,
          busy: false,
          preparedAt: null,
          completedAt: null
        };
      }
      renderRoute();
      showToast(`Respaldo exportado con ${quantity(artifact.photoCount)} foto${artifact.photoCount === 1 ? '' : 's'}.`);
      return true;
    } catch (error) {
      if (dangerOperation && dangerBackupAuthorization?.operationId === operationId) resetDangerBackupAuthorization();
      console.error('[PROMETEO] No se pudo exportar el respaldo.', error);
      if (safeRoute() === 'configuracion') renderRoute();
      showToast('No se pudo exportar el respaldo JSON.', 'error');
      return false;
    } finally {
      if (button && document.body.contains(button)) { button.disabled = false; button.textContent = originalText; }
    }
  }

  function validateBackupPayload(payload) {
    const fail = (message) => ({ ok: false, error: message });
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('El archivo no contiene un respaldo válido.');
    const header = payload.backup;
    if (!header || typeof header !== 'object') return fail('Falta la cabecera de respaldo.');
    if (header.format !== 'DOREN_FASHION_STYLE_BACKUP') return fail('El archivo no corresponde a un respaldo compatible con esta aplicación.');
    if (Number(header.formatVersion) !== 1) return fail('La versión del formato de respaldo no es compatible.');
    const schemaVersion = Number(header.schemaVersion);
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > APP.schemaVersion) return fail('La versión de datos del respaldo no es compatible con esta app.');
    const data = payload.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('Faltan los datos principales del respaldo.');
    if (!data.meta || typeof data.meta !== 'object') return fail('Faltan los metadatos del respaldo.');
    if (!data.configuraciones || typeof data.configuraciones !== 'object' || Array.isArray(data.configuraciones)) return fail('Falta la configuración del respaldo.');
    const hasIdentity = Object.prototype.hasOwnProperty.call(data.configuraciones, 'identidad');
    let normalizedIdentity = null;
    if (hasIdentity) {
      const rawIdentity = data.configuraciones.identidad;
      if (!rawIdentity || typeof rawIdentity !== 'object' || Array.isArray(rawIdentity)) return fail('La identidad comercial del respaldo no es válida.');
      for (const key of ['mainLogo', 'horizontalLogo']) {
        if (rawIdentity[key] != null && !validIdentityLogo(rawIdentity[key])) return fail('El respaldo contiene un logotipo de identidad dañado.');
      }
      normalizedIdentity = normalizeBusinessIdentity(rawIdentity);
    }
    for (const name of collections) {
      if (!Array.isArray(data[name])) return fail(`La colección “${name}” no es válida.`);
      if (data[name].some((item) => !item || typeof item !== 'object' || Array.isArray(item))) return fail(`Hay registros inválidos en “${name}”.`);
      const ids = data[name].map((item) => String(item.id || '')).filter(Boolean);
      if (new Set(ids).size !== ids.length) return fail(`Hay identificadores duplicados en “${name}”.`);
    }
    if (data.productos.some((product) => !product.id || !String(product.name || '').trim())) return fail('Hay productos sin identificador o nombre.');
    const productIds = new Set(data.productos.map((product) => String(product.id)));
    const variantIds = new Set();
    for (const variant of data.variantes) {
      if (!variant.id || !variant.productId || !productIds.has(String(variant.productId))) return fail('Hay variantes sin producto válido.');
      if (variantIds.has(String(variant.id))) return fail('Hay variantes duplicadas.');
      variantIds.add(String(variant.id));
      const stock = Number(variant.stock);
      if (!Number.isFinite(stock) || stock < 0) return fail('El respaldo contiene existencias negativas o inválidas.');
    }
    const paymentFields = [
      ...data.ventas.map((record) => record.paymentMethod).filter(Boolean),
      ...data.cobros.map((record) => record.method || record.paymentMethod).filter(Boolean),
      ...data.compras.map((record) => record.paymentMethod).filter(Boolean),
      ...data.pagosProveedores.map((record) => record.method || record.paymentMethod).filter(Boolean),
      ...data.gastos.map((record) => record.method || record.paymentMethod).filter(Boolean)
    ];
    if (paymentFields.some((method) => !PAYMENT_METHODS.includes(String(method)))) return fail('El respaldo contiene métodos de pago no permitidos.');
    if (!Object.prototype.hasOwnProperty.call(payload, 'photos') || !Array.isArray(payload.photos)) return fail('El respaldo está incompleto: falta la colección de fotografías.');
    const photos = payload.photos;
    const seenPhotos = new Set();
    for (const photo of photos) {
      if (!photo || typeof photo !== 'object' || !productIds.has(String(photo.productId || ''))) return fail('Hay una foto asociada a un producto inválido.');
      if (seenPhotos.has(String(photo.productId))) return fail('Hay fotos duplicadas para un producto.');
      seenPhotos.add(String(photo.productId));
      if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(String(photo.dataUrl || ''))) return fail('El respaldo contiene una foto dañada.');
    }
    const expectedPhotoProducts = data.productos.filter((product) => product.photoMeta).map((product) => String(product.id));
    if (expectedPhotoProducts.some((productId) => !seenPhotos.has(productId))) return fail('El respaldo está incompleto: falta al menos una fotografía asociada a un producto.');
    const exportedAt = new Date(header.exportedAt || '');
    if (Number.isNaN(exportedAt.getTime())) return fail('La fecha de exportación del respaldo no es válida.');
    return { ok: true, data, photos, hasIdentity, identity: normalizedIdentity, schemaVersion };
  }

  async function verifyImportedBackupState(expectedState, expectedPhotos, preservedIdentity) {
    const persisted = store.readRaw();
    if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) throw new Error('No se pudo releer el estado restaurado.');

    for (const name of collections) {
      const expected = Array.isArray(expectedState[name]) ? expectedState[name] : [];
      const actual = persisted[name];
      if (!Array.isArray(actual) || actual.length !== expected.length) throw new Error(`La colección ${name} no quedó restaurada completamente.`);
      const expectedIds = expected.map((item) => String(item.id || '')).sort();
      const actualIds = actual.map((item) => String(item.id || '')).sort();
      if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) throw new Error(`La colección ${name} no conserva los mismos registros.`);
      const actualById = new Map(actual.map((item) => [String(item.id || ''), item]));
      for (const expectedRecord of expected) {
        const actualRecord = actualById.get(String(expectedRecord.id || ''));
        if (!actualRecord) throw new Error(`Falta un registro esperado en ${name}.`);
        for (const [key, value] of Object.entries(expectedRecord)) {
          if (JSON.stringify(actualRecord[key]) !== JSON.stringify(value)) {
            throw new Error(`El registro ${expectedRecord.id || 'sin-id'} de ${name} cambió inesperadamente durante la restauración.`);
          }
        }
      }
    }

    const currentIdentity = normalizeBusinessIdentity(persisted.configuraciones?.identidad);
    if (JSON.stringify(currentIdentity) !== JSON.stringify(normalizeBusinessIdentity(preservedIdentity))) {
      throw new Error('La Identidad del negocio cambió durante la restauración.');
    }

    const restoredPhotos = await photoStore.entries();
    if (restoredPhotos.length !== expectedPhotos.length) throw new Error('La cantidad de fotografías restauradas no coincide con el respaldo.');
    const restoredPhotoMap = new Map(restoredPhotos.map(([key, value]) => [String(key), value]));
    for (const [key, expectedBlob] of expectedPhotos) {
      const actualBlob = restoredPhotoMap.get(String(key));
      if (!(actualBlob instanceof Blob)) throw new Error(`No se restauró la fotografía de ${key}.`);
      if (actualBlob.size !== expectedBlob.size || String(actualBlob.type || '') !== String(expectedBlob.type || '')) {
        throw new Error(`La fotografía de ${key} no coincide con el respaldo.`);
      }
    }
    return true;
  }

  async function importBackupFile(file) {
    if (!file) return;
    if (backupImportBusy) {
      showToast('Ya hay una restauración en curso.', 'error');
      return;
    }
    if (!/\.json$/i.test(file.name || '') && file.type && file.type !== 'application/json') {
      showToast('Selecciona un archivo JSON de respaldo.', 'error');
      return;
    }
    backupImportBusy = true;
    try {
      const text = await file.text();
      let payload;
      try { payload = JSON.parse(text); }
      catch { showToast('El archivo JSON está dañado o mal formado.', 'error'); return; }
      const validation = validateBackupPayload(payload);
      if (!validation.ok) { showToast(validation.error, 'error'); return; }

      const preparedPhotos = [];
      try {
        for (const photo of validation.photos) preparedPhotos.push([String(photo.productId), dataUrlToBlob(photo.dataUrl)]);
      } catch (error) {
        console.error('[PROMETEO] Foto inválida en respaldo.', error);
        showToast('El respaldo contiene una foto que no se pudo reconstruir.', 'error');
        return;
      }

      const confirmed = window.confirm(`Respaldo válido (${validation.data.productos.length} productos, ${validation.data.ventas.length} ventas, ${preparedPhotos.length} fotos).\n\n¿Importarlo y reemplazar los datos operativos actuales?\n\nLa Identidad del negocio y sus logotipos actuales se conservarán.`);
      if (!confirmed) return;

      const previousState = store.getState();
      const preservedIdentity = normalizeBusinessIdentity(previousState.configuraciones?.identidad);
      const previousPhotos = await photoStore.entries();
      const importedState = JSON.parse(JSON.stringify(validation.data));
      importedState.configuraciones = importedState.configuraciones || {};
      importedState.configuraciones.identidad = preservedIdentity;
      importedState.configuraciones.respaldo = importedState.configuraciones.respaldo || {};
      importedState.configuraciones.respaldo.lastImportAt = new Date().toISOString();
      importedState.configuraciones.respaldo.lastImportFile = String(file.name || 'respaldo.json');
      importedState.meta = importedState.meta || {};
      importedState.meta.schemaVersion = APP.schemaVersion;
      importedState.meta.appName = APP.name;
      importedState.meta.appVersion = APP.version;

      try {
        if (!store.writeRaw(importedState)) throw new Error('No se pudieron guardar los datos importados');
        await photoStore.replaceAll(preparedPhotos);
        store.ensureSchema();
        await verifyImportedBackupState(importedState, preparedPhotos, preservedIdentity);
      } catch (error) {
        console.error('[PROMETEO] Falló la importación o su verificación; se intenta revertir.', error);
        let rollbackFailed = false;
        try {
          if (!store.writeRaw(previousState)) rollbackFailed = true;
          await photoStore.replaceAll(previousPhotos);
        } catch (rollbackError) {
          rollbackFailed = true;
          console.error('[PROMETEO] También falló la reversión de la importación.', rollbackError);
        }
        showToast(
          rollbackFailed
            ? 'La restauración falló y la reversión automática también tuvo una falla. Revisa la consola y conserva el JSON original.'
            : 'La restauración falló o no pudo verificarse. Se recuperó el estado anterior.',
          'error'
        );
        return;
      }

      selectedClientId = null;
      selectedProviderId = null;
      resetDangerBackupAuthorization();
      renderRoute();
      showToast('Respaldo restaurado y verificado. Datos y fotografías recuperados; Identidad del negocio preservada.');
    } catch (error) {
      console.error('[PROMETEO] No se pudo importar el respaldo.', error);
      showToast('No se pudo importar el respaldo JSON.', 'error');
    } finally {
      backupImportBusy = false;
    }
  }

  async function installPwa() {
    if (window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true) {
      showToast(`${getBusinessIdentity().appName} ya está instalada.`);
      return;
    }
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      renderRoute();
      return;
    }
    showToast('Usa la opción “Instalar app” o “Añadir a pantalla de inicio” de tu navegador.', 'error');
  }

  async function checkPwaUpdate(button) {
    if (swUpdateCheckPromise) return swUpdateCheckPromise;
    if (!('serviceWorker' in navigator) || !['http:', 'https:'].includes(location.protocol)) {
      showToast('Este navegador o entorno no admite la actualización PWA.', 'error');
      return null;
    }

    const originalText = button?.textContent || 'Buscar actualización';
    const runCheck = async () => {
      if (button) { button.disabled = true; button.textContent = 'Buscando…'; }
      try {
        if (!navigator.onLine) {
          const existing = swRegistration || await findExistingServiceWorkerRegistration().catch(() => null);
          if (existing) observeServiceWorkerRegistration(existing);
          syncServiceWorkerState(existing || swRegistration);
          showToast('Sin conexión. Se necesita internet para buscar una versión nueva.', 'error');
          return { status: 'offline' };
        }

        const registration = await ensureServiceWorkerRegistration({ allowRegister: true, waitForReady: true });
        if (!registration) {
          if (rootControllerIsActive()) {
            setServiceWorkerRuntimeState('active');
            showToast('Service Worker activo, pero no se pudo consultar la actualización. Intenta nuevamente.', 'error');
            return { status: 'update-check-unavailable' };
          }
          showToast('No se pudo registrar el Service Worker raíz.', 'error');
          return { status: 'registration-error' };
        }

        observeServiceWorkerRegistration(registration);
        syncServiceWorkerState(registration);
        const result = await checkRegistrationForUpdate(registration);
        syncServiceWorkerState(registration);

        if (!result.updated) {
          showToast('La app ya está actualizada.');
          return { status: 'current' };
        }

        return { status: 'update-found', workerState: result.worker?.state || result.outcome || 'desconocido' };
      } catch (error) {
        console.error('[DOREN] No se pudo buscar actualización.', error);
        syncServiceWorkerState(swRegistration);
        showToast('No se pudo comprobar la actualización.', 'error');
        return { status: 'error', error };
      } finally {
        if (button?.isConnected) { button.disabled = false; button.textContent = originalText; }
      }
    };

    swUpdateCheckPromise = runCheck().finally(() => { swUpdateCheckPromise = null; });
    return swUpdateCheckPromise;
  }


  function normalizePhone(value = '') {
    return String(value).replace(/\D+/g, '');
  }

  function numericValue(record, keys) {
    for (const key of keys) {
      const value = Number(record?.[key]);
      if (Number.isFinite(value)) return value;
    }
    return 0;
  }

  function clientMatchesRecord(record, clientId) {
    return String(record?.clientId || record?.clienteId || '') === String(clientId);
  }

  function isPaymentCancelled(payment) {
    return ['anulado', 'anulada', 'cancelado', 'cancelada'].includes(String(payment?.status || payment?.estado || '').toLowerCase());
  }

  function localDateKey(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function paymentHistoryForSale(state, saleId) {
    return state.cobros
      .filter((payment) => String(payment.saleId || payment.ventaId || '') === String(saleId))
      .filter((payment) => !isPaymentCancelled(payment))
      .slice()
      .sort((a, b) => new Date(a.date || a.fecha || a.createdAt || 0).getTime() - new Date(b.date || b.fecha || b.createdAt || 0).getTime());
  }

  function saleFinancialState(state, sale, todayKey = localDateKey()) {
    const total = Math.max(0, numericValue(sale, ['total', 'totalVenta', 'netTotal', 'totalNeto', 'subtotal']));
    const payments = paymentHistoryForSale(state, sale.id);
    const linkedPaid = payments.reduce((sum, payment) => sum + numericValue(payment, ['amount', 'monto', 'total', 'importe']), 0);
    const legacyInitial = Math.max(0, numericValue(sale, ['initialPayment', 'abonoInicial']));
    const paid = Math.min(total, Math.max(0, payments.length ? linkedPaid : legacyInitial));
    const balance = Math.max(0, total - paid);
    const type = String(sale.type || 'contado').toLowerCase();
    const dueDate = sale.dueDate ? String(sale.dueDate).slice(0, 10) : '';
    let status = 'Pendiente';
    let statusKey = 'pendiente';

    if (isSaleCancelled(sale)) {
      status = 'Anulada';
      statusKey = 'anulada';
    } else if (type !== 'credito' || balance <= 0.005) {
      status = 'Pagado';
      statusKey = 'pagado';
    } else if (dueDate && dueDate < todayKey) {
      status = 'Vencido';
      statusKey = 'vencido';
    } else if (paid > 0.005) {
      status = 'Abonado';
      statusKey = 'abonado';
    }

    return { total, paid, balance, status, statusKey, dueDate, payments };
  }

  function statusClass(statusKey) {
    if (statusKey === 'pagado') return 'paid';
    if (statusKey === 'vencido') return 'overdue';
    if (statusKey === 'abonado') return 'partial';
    if (statusKey === 'anulada') return 'inactive';
    return 'pending';
  }

  function clientStats(state, clientId) {
    const sales = state.ventas
      .filter((sale) => clientMatchesRecord(sale, clientId))
      .filter((sale) => !isSaleCancelled(sale));
    const payments = state.cobros
      .filter((payment) => clientMatchesRecord(payment, clientId))
      .filter((payment) => !isPaymentCancelled(payment));

    const totalPurchased = sales.reduce((sum, sale) => sum + saleFinancialState(state, sale).total, 0);
    const totalPaid = sales.reduce((sum, sale) => sum + saleFinancialState(state, sale).paid, 0);
    const balance = sales.reduce((sum, sale) => sum + saleFinancialState(state, sale).balance, 0);
    const orderedPayments = payments.slice().sort((a, b) => {
      const aDate = new Date(a.date || a.fecha || a.createdAt || 0).getTime() || 0;
      const bDate = new Date(b.date || b.fecha || b.createdAt || 0).getTime() || 0;
      return bDate - aDate;
    });

    return {
      totalPurchased,
      totalPaid,
      balance,
      lastPayment: orderedPayments[0] || null,
      sales,
      payments: orderedPayments
    };
  }

  function clientInitials(name = '') {
    const words = String(name).trim().split(/\s+/).filter(Boolean);
    return (words.slice(0, 2).map((word) => word[0]?.toUpperCase() || '').join('') || 'CL').slice(0, 2);
  }

  function renderClients(module) {
    const state = store.getState();
    if (selectedClientId) {
      const client = state.clientes.find((item) => item.id === selectedClientId);
      if (client) return renderClientDetail(module, state, client);
      selectedClientId = null;
    }

    const normalizedSearch = clientSearch.trim().toLowerCase();
    const normalizedPhoneSearch = normalizePhone(clientSearch);
    const clients = state.clientes
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }))
      .filter((client) => {
        if (!normalizedSearch) return true;
        const nameMatch = String(client.name || '').toLowerCase().includes(normalizedSearch);
        const phoneMatch = normalizedPhoneSearch && normalizePhone(client.phone).includes(normalizedPhoneSearch);
        return nameMatch || phoneMatch;
      });

    return `
      <section class="page-panel clients-page" aria-labelledby="pageTitle">
        <div class="page-heading clients-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div>
              <h1 id="pageTitle">Clientes</h1>
              <p>Fichas de clientes conectadas con compras, cobros, saldos y estado de cuenta.</p>
            </div>
          </div>
          <span class="stage-chip">V1</span>
        </div>

        <div class="clients-toolbar">
          <label class="search-field clients-search">
            <span class="sr-only">Buscar cliente por nombre o teléfono</span>
            <input id="clientSearch" type="search" value="${escapeHtml(clientSearch)}" placeholder="Buscar por nombre o teléfono…" autocomplete="off">
          </label>
          <button class="button button--primary" type="button" data-action="add-client">＋ Agregar cliente</button>
        </div>

        <div class="clients-list-heading">
          <div>
            <h2>Clientes registrados</h2>
            <p>${quantity(clients.length)} visible${clients.length === 1 ? '' : 's'} · ${quantity(state.clientes.length)} total${state.clientes.length === 1 ? '' : 'es'}</p>
          </div>
        </div>

        <div class="clients-list" aria-live="polite">
          ${clients.length ? clients.map((client) => renderClientRow(state, client)).join('') : renderClientsEmpty(state)}
        </div>
      </section>
      <div id="modalRoot"></div>
    `;
  }

  function renderClientsEmpty(state) {
    if (!state.clientes.length) {
      return `
        <div class="clients-empty">
          <span class="clients-empty__mark" aria-hidden="true">♙</span>
          <h3>Aún no hay clientes</h3>
          <p>Agrega el primer cliente para crear su ficha. No se generarán ventas, cobros ni saldos ficticios.</p>
          <button class="button button--primary" type="button" data-action="add-client">＋ Agregar cliente</button>
        </div>`;
    }
    return `
      <div class="clients-empty">
        <span class="clients-empty__mark" aria-hidden="true">⌕</span>
        <h3>Sin coincidencias</h3>
        <p>No encontramos clientes con ese nombre o teléfono.</p>
        <button class="button button--secondary" type="button" data-action="clear-client-search">Limpiar búsqueda</button>
      </div>`;
  }

  function renderClientRow(state, client) {
    const stats = clientStats(state, client.id);
    return `
      <article class="client-row" data-client-id="${client.id}">
        <div class="client-row__identity">
          <span class="client-avatar" aria-hidden="true">${escapeHtml(clientInitials(client.name))}</span>
          <div>
            <h3>${escapeHtml(client.name || 'Cliente')}</h3>
            <p>${escapeHtml(client.phone || 'Sin teléfono')}</p>
          </div>
        </div>
        <div class="client-row__summary">
          <span>Saldo pendiente</span>
          <strong>${money(stats.balance)}</strong>
        </div>
        <div class="client-row__actions">
          <button class="button button--secondary button--compact" type="button" data-action="edit-client" data-client-id="${client.id}">Editar</button>
          <button class="button button--primary button--compact" type="button" data-action="view-client" data-client-id="${client.id}">Ver ficha</button>
        </div>
      </article>`;
  }

  function renderClientDetail(module, state, client) {
    const stats = clientStats(state, client.id);
    const lastPaymentDate = stats.lastPayment ? (stats.lastPayment.date || stats.lastPayment.fecha || stats.lastPayment.createdAt) : null;
    const purchaseRows = stats.sales.length
      ? stats.sales.slice().sort((a, b) => new Date(b.date || b.fecha || b.createdAt || 0) - new Date(a.date || a.fecha || a.createdAt || 0)).map((sale) => `
          <div class="client-history-row">
            <div><strong>${formatDate(sale.date || sale.fecha || sale.createdAt)}</strong><span>${escapeHtml(sale.reference || sale.referencia || sale.id || 'Venta')} · ${saleFinancialState(state, sale).status}</span></div>
            <strong>${money(saleFinancialState(state, sale).total)}</strong>
          </div>`).join('')
      : '<div class="client-history-empty">Todavía no existen compras reales para este cliente.</div>';
    const paymentRows = stats.payments.length
      ? stats.payments.map((payment) => `
          <div class="client-history-row">
            <div><strong>${formatDate(payment.date || payment.fecha || payment.createdAt)}</strong><span>${escapeHtml(payment.kind || 'Abono')} · ${escapeHtml(payment.method || payment.metodo || '—')} · ${escapeHtml(payment.reference || payment.referencia || '')}</span></div>
            <strong>${money(numericValue(payment, ['amount', 'monto', 'total', 'importe']))}</strong>
          </div>`).join('')
      : '<div class="client-history-empty">Todavía no existen abonos reales para este cliente.</div>';

    return `
      <section class="page-panel client-detail-page" aria-labelledby="pageTitle">
        <div class="client-detail-topbar">
          <button class="button button--ghost button--compact" type="button" data-action="clients-back">← Clientes</button>
          <div class="client-detail-actions">
            <button class="button button--secondary" type="button" data-action="edit-client" data-client-id="${client.id}">✎ Editar</button>
            <button class="button button--primary" type="button" data-action="copy-client-state" data-client-id="${client.id}">⧉ Copiar</button>
          </div>
        </div>

        <div class="client-profile-header">
          <span class="client-avatar client-avatar--large" aria-hidden="true">${escapeHtml(clientInitials(client.name))}</span>
          <div class="client-profile-header__copy">
            <p class="client-profile-eyebrow">FICHA DEL CLIENTE</p>
            <h1 id="pageTitle">${escapeHtml(client.name || 'Cliente')}</h1>
            <p>${escapeHtml(client.phone || 'Sin teléfono')}</p>
          </div>
        </div>

        <div class="client-contact-grid">
          <div><span>Teléfono / WhatsApp</span><strong>${escapeHtml(client.phone || '—')}</strong></div>
          <div><span>Dirección</span><strong>${escapeHtml(client.address || '—')}</strong></div>
          <div class="client-contact-grid__wide"><span>Observación</span><strong>${escapeHtml(client.observation || '—')}</strong></div>
        </div>

        <section class="client-balance-panel" aria-label="Estado de cuenta">
          <div class="client-balance-metric"><span>Total comprado</span><strong>${money(stats.totalPurchased)}</strong></div>
          <div class="client-balance-metric"><span>Total pagado</span><strong>${money(stats.totalPaid)}</strong></div>
          <div class="client-balance-metric client-balance-metric--accent"><span>Saldo pendiente</span><strong>${money(stats.balance)}</strong></div>
          <div class="client-balance-metric"><span>Último pago</span><strong>${lastPaymentDate ? formatDate(lastPaymentDate) : '—'}</strong></div>
        </section>

        <div class="client-history-grid">
          <section class="client-history-block">
            <div class="client-history-heading"><h2>Compras realizadas</h2><span>${quantity(stats.sales.length)}</span></div>
            <div class="client-history-list">${purchaseRows}</div>
          </section>
          <section class="client-history-block">
            <div class="client-history-heading"><h2>Historial de abonos</h2><span>${quantity(stats.payments.length)}</span></div>
            <div class="client-history-list">${paymentRows}</div>
          </section>
        </div>
      </section>
      <div id="modalRoot"></div>
    `;
  }

  function openClientForm(clientId = null) {
    const state = store.getState();
    const client = clientId ? state.clientes.find((item) => item.id === clientId) : null;
    if (clientId && !client) {
      showToast('No se encontró el cliente.', 'error');
      return;
    }

    openModal(`
      <form id="clientForm" novalidate>
        <div class="modal-header">
          <div>
            <p class="modal-eyebrow">CLIENTES</p>
            <h2 id="modalTitle">${client ? 'Editar cliente' : 'Agregar cliente'}</h2>
            <p>Datos básicos para identificar al cliente y relacionarlo con ventas y cobros.</p>
          </div>
          <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body">
          <div class="fields-grid fields-grid--2 client-form-fields">
            <label class="field-group field-group--wide">
              <span>Nombre *</span>
              <input id="clientName" type="text" value="${escapeHtml(client?.name || '')}" maxlength="140" autocomplete="name" required>
            </label>
            <label class="field-group field-group--wide">
              <span>Teléfono / WhatsApp *</span>
              <input id="clientPhone" type="tel" value="${escapeHtml(client?.phone || '')}" maxlength="40" inputmode="tel" autocomplete="tel" required>
            </label>
            <label class="field-group field-group--wide">
              <span>Dirección <small>(opcional)</small></span>
              <textarea id="clientAddress" rows="2" maxlength="300">${escapeHtml(client?.address || '')}</textarea>
            </label>
            <label class="field-group field-group--wide">
              <span>Observación <small>(opcional)</small></span>
              <textarea id="clientObservation" rows="3" maxlength="500">${escapeHtml(client?.observation || '')}</textarea>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button>
          <button class="button button--primary" type="submit">${client ? 'Guardar cambios' : 'Guardar cliente'}</button>
        </div>
      </form>`, 'modal--medium');

    const form = document.getElementById('clientForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = {
        name: document.getElementById('clientName').value.trim(),
        phone: document.getElementById('clientPhone').value.trim(),
        address: document.getElementById('clientAddress').value.trim(),
        observation: document.getElementById('clientObservation').value.trim()
      };

      if (!data.name || !data.phone || !normalizePhone(data.phone)) {
        showToast('Completa correctamente el nombre y el teléfono / WhatsApp.', 'error');
        return;
      }

      const current = store.getState();
      const phoneKey = normalizePhone(data.phone);
      const duplicatePhone = current.clientes.some((item) => item.id !== clientId && normalizePhone(item.phone) === phoneKey);
      if (duplicatePhone) {
        showToast('Ya existe otro cliente con ese teléfono / WhatsApp.', 'error');
        return;
      }

      const now = new Date().toISOString();
      const targetId = clientId || uid('cli');
      const saved = store.transact((draft) => {
        if (clientId) {
          const index = draft.clientes.findIndex((item) => item.id === clientId);
          if (index >= 0) draft.clientes[index] = { ...draft.clientes[index], ...data, updatedAt: now };
        } else {
          draft.clientes.push({ id: targetId, ...data, createdAt: now, updatedAt: now });
        }
      });

      if (!saved) {
        showToast('No se pudo guardar el cliente.', 'error');
        return;
      }

      selectedClientId = targetId;
      closeModal();
      renderRoute();
      showToast(client ? 'Cliente actualizado correctamente.' : 'Cliente guardado correctamente.');
    });
  }

  function clientStateText(state, client) {
    const identity = getBusinessIdentity(state);
    const stats = clientStats(state, client.id);
    const movements = [];
    stats.sales.forEach((sale) => {
      movements.push({
        date: sale.date || sale.fecha || sale.createdAt,
        createdAt: sale.createdAt || sale.date,
        text: `Compra ${sale.reference || sale.id || ''}`.trim(),
        amount: saleFinancialState(state, sale).total
      });
    });
    stats.payments.forEach((payment) => {
      movements.push({
        date: payment.date || payment.fecha || payment.createdAt,
        createdAt: payment.createdAt || payment.date,
        text: `${payment.kind || 'Abono'} ${payment.reference || ''} · ${payment.method || '—'}`.trim(),
        amount: numericValue(payment, ['amount', 'monto', 'total', 'importe'])
      });
    });
    movements.sort((a, b) => {
      const aDay = String(a.date || a.createdAt || '').slice(0, 10);
      const bDay = String(b.date || b.createdAt || '').slice(0, 10);
      if (aDay !== bDay) return aDay.localeCompare(bDay);
      return String(a.createdAt || a.date || '').localeCompare(String(b.createdAt || b.date || ''));
    });
    const detail = movements.length
      ? movements.map((item) => `${formatDate(item.date)} ${item.text} ${money(item.amount)}`).join('\n')
      : 'Sin movimientos registrados.';

    const contactLine = businessIdentityContactItems(identity).slice(0, 3).join(' · ');
    const identityDisplayName = businessIdentityDisplayName(identity);
    return `${identityDisplayName}${identity.slogan ? `\n${identity.slogan}` : ''}${contactLine ? `\n${contactLine}` : ''}

Cliente: ${client.name}

Compras: ${money(stats.totalPurchased)}
Pagado: ${money(stats.totalPaid)}
Saldo pendiente: ${money(stats.balance)}

Detalle:
${detail}`;
  }

  async function copyClientState(clientId) {
    const state = store.getState();
    const client = state.clientes.find((item) => item.id === clientId);
    if (!client) {
      showToast('No se encontró el cliente.', 'error');
      return;
    }
    const text = clientStateText(state, client);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (error) {
      console.warn('[DOREN] Clipboard API no disponible; se intentará método alterno.', error);
    }

    if (!copied) {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
      helper.remove();
    }

    showToast(copied ? 'Estado de cuenta copiado.' : 'No se pudo copiar el estado de cuenta.', copied ? 'success' : 'error');
  }

  const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta'];

  function effectiveVariantSalePrice(product, variant) {
    const override = Number(variant?.salePriceOverride);
    return Number.isFinite(override) && variant?.salePriceOverride !== null ? override : (Number(product?.salePrice) || 0);
  }

  function effectiveVariantPurchasePrice(product, variant) {
    const override = Number(variant?.purchasePriceOverride);
    return Number.isFinite(override) && variant?.purchasePriceOverride !== null ? override : (Number(product?.purchasePrice) || 0);
  }

  function isSaleCancelled(sale) {
    return ['anulado', 'anulada', 'cancelado', 'cancelada'].includes(String(sale?.status || sale?.estado || '').toLowerCase());
  }

  function saleNumber(state) {
    const max = state.ventas.reduce((value, sale) => Math.max(value, Number(sale.saleNumber) || 0), 0);
    return max + 1;
  }

  function saleReference(number) {
    return `VEN-${String(number).padStart(6, '0')}`;
  }

  function saleSummary(state) {
    const confirmed = state.ventas.filter((sale) => !isSaleCancelled(sale));
    return confirmed.reduce((summary, sale) => {
      summary.count += 1;
      summary.gross += numericValue(sale, ['subtotalBruto', 'grossSubtotal', 'subtotal']);
      summary.discounts += numericValue(sale, ['discountTotal', 'descuentoTotal', 'descuentos']);
      summary.net += numericValue(sale, ['total', 'netTotal', 'totalNeto']);
      summary.utility += numericValue(sale, ['totalUtility', 'utilidadTotal']);
      summary.balance += saleFinancialState(state, sale).balance;
      return summary;
    }, { count: 0, gross: 0, discounts: 0, net: 0, utility: 0, balance: 0 });
  }

  function saleClientName(state, sale) {
    if (sale.clientSnapshot?.name) return sale.clientSnapshot.name;
    const client = state.clientes.find((item) => item.id === sale.clientId);
    return client?.name || 'Cliente de contado';
  }

  function renderSales(module) {
    const state = store.getState();
    const summary = saleSummary(state);
    const normalizedSearch = saleSearch.trim().toLowerCase();
    const sales = state.ventas
      .slice()
      .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
      .filter((sale) => {
        if (saleTypeFilter !== 'todos' && String(sale.type || '').toLowerCase() !== saleTypeFilter) return false;
        if (!normalizedSearch) return true;
        const haystack = [sale.reference, saleClientName(state, sale), sale.paymentMethod, sale.type]
          .concat((sale.lines || []).flatMap((line) => [line.productName, line.variantLabel]))
          .join(' ').toLowerCase();
        return haystack.includes(normalizedSearch);
      });

    return `
      <section class="page-panel sales-page" aria-labelledby="pageTitle">
        <div class="page-heading sales-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div>
              <h1 id="pageTitle">Ventas</h1>
              <p>Ventas de contado y crédito con descuento fijo por pieza, stock por variante y utilidad real histórica.</p>
            </div>
          </div>
          <span class="stage-chip">V1</span>
        </div>

        <section class="sales-summary" aria-label="Resumen de ventas">
          <article class="metric-card"><span>Ventas confirmadas</span><strong>${quantity(summary.count)}</strong></article>
          <article class="metric-card"><span>Venta neta</span><strong>${money(summary.net)}</strong></article>
          <article class="metric-card"><span>Descuentos</span><strong>${money(summary.discounts)}</strong></article>
          <article class="metric-card"><span>Utilidad real</span><strong class="${summary.utility < 0 ? 'negative-value' : ''}">${money(summary.utility)}</strong></article>
        </section>

        <div class="sales-toolbar">
          <div class="sales-toolbar__filters">
            <label class="search-field sales-search">
              <span class="sr-only">Buscar venta</span>
              <input id="saleSearch" type="search" value="${escapeHtml(saleSearch)}" placeholder="Buscar referencia, cliente o producto…" autocomplete="off">
            </label>
            <label class="select-field">
              <span>Tipo</span>
              <select id="saleTypeFilter">
                <option value="todos" ${saleTypeFilter === 'todos' ? 'selected' : ''}>Todos</option>
                <option value="contado" ${saleTypeFilter === 'contado' ? 'selected' : ''}>Contado</option>
                <option value="credito" ${saleTypeFilter === 'credito' ? 'selected' : ''}>Crédito</option>
              </select>
            </label>
          </div>
          <button class="button button--primary" type="button" data-action="new-sale">＋ Nueva venta</button>
        </div>

        <div class="sales-list-heading">
          <div>
            <h2>Historial de ventas</h2>
            <p>${quantity(sales.length)} registro${sales.length === 1 ? '' : 's'} visible${sales.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div class="sales-list" aria-live="polite">
          ${sales.length ? sales.map((sale) => renderSaleRow(state, sale)).join('') : `
            <div class="sales-empty">
              <span class="sales-empty__mark" aria-hidden="true">◈</span>
              <h3>${state.ventas.length ? 'Sin coincidencias' : 'Aún no hay ventas'}</h3>
              <p>${state.ventas.length ? 'Cambia los filtros para ver otros registros.' : 'Registra la primera venta. El stock se descontará solo al confirmar.'}</p>
              ${state.ventas.length ? '' : '<button class="button button--primary" type="button" data-action="new-sale">＋ Nueva venta</button>'}
            </div>`}
        </div>
      </section>
      <div id="modalRoot"></div>
    `;
  }

  function renderSaleRow(state, sale) {
    const type = String(sale.type || 'contado').toLowerCase();
    const financial = saleFinancialState(state, sale);
    const itemCount = (sale.lines || []).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
    return `
      <article class="sale-row">
        <div class="sale-row__identity">
          <div class="sale-row__reference"><strong>${escapeHtml(sale.reference || sale.id || 'Venta')}</strong><span>${formatDate(sale.date || sale.createdAt, true)}</span></div>
          <div><strong>${escapeHtml(saleClientName(state, sale))}</strong><span>${type === 'credito' ? 'Crédito' : 'Contado'} · ${quantity(itemCount)} pieza${itemCount === 1 ? '' : 's'}</span></div>
        </div>
        <div class="sale-row__money"><span>Total neto</span><strong>${money(financial.total)}</strong></div>
        <div class="sale-row__money"><span>${type === 'credito' ? 'Saldo' : 'Utilidad'}</span><strong class="${type === 'credito' ? '' : (numericValue(sale, ['totalUtility', 'utilidadTotal']) < 0 ? 'negative-value' : '')}">${type === 'credito' ? money(financial.balance) : money(numericValue(sale, ['totalUtility', 'utilidadTotal']))}</strong></div>
        <div class="sale-row__status"><span class="status-pill status-pill--${statusClass(financial.statusKey)}">${financial.status}</span></div>
        <button class="button button--secondary button--compact" type="button" data-action="view-sale" data-sale-id="${sale.id}">Ver</button>
      </article>`;
  }

  function saleLineEditorTemplate(state) {
    const products = state.productos
      .filter((product) => product.active && productVariants(state, product.id).length)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
    return `
      <article class="sale-line-editor" data-sale-line>
        <div class="sale-line-editor__main">
          <label class="field-group sale-line-product">
            <span>Producto *</span>
            <select data-sale-product required>
              ${products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)} · ${escapeHtml(product.internalCode || '')}</option>`).join('')}
            </select>
          </label>
          <label class="field-group sale-line-variant">
            <span>Variante *</span>
            <select data-sale-variant required></select>
          </label>
          <label class="field-group sale-line-qty">
            <span>Cantidad *</span>
            <input data-sale-qty type="number" min="1" step="1" inputmode="numeric" required>
          </label>
          <label class="field-group sale-line-discount">
            <span>Descuento / pieza</span>
            <div class="money-input"><span>C$</span><input data-sale-discount type="number" min="0" step="0.01" inputmode="decimal"></div>
          </label>
          <button class="icon-text-button icon-text-button--danger sale-line-remove" type="button" data-action="remove-sale-line">× <span>Quitar</span></button>
        </div>
        <div class="sale-line-editor__snapshot">
          <div><span>Precio unitario</span><strong data-sale-price>${money(0)}</strong></div>
          <div><span>Disponible</span><strong data-sale-stock>0</strong></div>
          <div><span>Descuento total</span><strong data-sale-discount-total>${money(0)}</strong></div>
          <div><span>Total línea</span><strong data-sale-line-total>${money(0)}</strong></div>
          <div><span>Utilidad línea</span><strong data-sale-line-utility>${money(0)}</strong></div>
        </div>
      </article>`;
  }

  function prepareSaleLine(state, spec) {
    const product = state.productos.find((item) => item.id === spec.productId);
    const variant = state.variantes.find((item) => item.id === spec.variantId && item.productId === spec.productId);
    if (!product || !product.active || !variant) return { ok: false, error: 'Producto o variante no disponible.' };

    const qty = Number.parseInt(spec.quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: 'La cantidad debe ser un entero mayor que cero.' };

    const rawDiscount = spec.unitDiscount === '' || spec.unitDiscount === null || typeof spec.unitDiscount === 'undefined' ? 0 : Number(spec.unitDiscount);
    if (!Number.isFinite(rawDiscount) || rawDiscount < 0) return { ok: false, error: 'El descuento por pieza debe ser un monto válido mayor o igual a cero.' };

    const salePrice = effectiveVariantSalePrice(product, variant);
    const purchasePrice = effectiveVariantPurchasePrice(product, variant);
    if (rawDiscount > salePrice) return { ok: false, error: 'El descuento por pieza no puede superar el precio unitario.' };

    const grossTotal = salePrice * qty;
    const discountTotal = rawDiscount * qty;
    const lineTotal = qty * (salePrice - rawDiscount);
    const unitUtility = (salePrice - rawDiscount) - purchasePrice;
    const lineUtility = unitUtility * qty;

    return {
      ok: true,
      data: {
        product,
        variant,
        qty,
        unitDiscount: rawDiscount,
        salePrice,
        purchasePrice,
        grossTotal,
        discountTotal,
        lineTotal,
        unitUtility,
        lineUtility
      }
    };
  }

  function preparedSaleTotals(lines) {
    return lines.reduce((acc, data) => {
      acc.gross += data.grossTotal;
      acc.discounts += data.discountTotal;
      acc.net += data.lineTotal;
      acc.utility += data.lineUtility;
      return acc;
    }, { gross: 0, discounts: 0, net: 0, utility: 0 });
  }

  function commitSale(options) {
    const current = store.getState();
    const type = String(options.type || '').toLowerCase();
    if (!['contado', 'credito'].includes(type)) return { ok: false, error: 'Tipo de venta inválido.' };

    const clientId = options.clientId || null;
    if (type === 'credito' && !clientId) return { ok: false, error: 'La venta al crédito requiere un cliente.' };
    const currentClient = clientId ? current.clientes.find((item) => item.id === clientId) : null;
    if (clientId && !currentClient) return { ok: false, error: 'El cliente seleccionado ya no existe.' };

    const method = String(options.method || '');
    if (!PAYMENT_METHODS.includes(method)) return { ok: false, error: 'Selecciona un método de pago válido.' };

    const specs = Array.isArray(options.lines) ? options.lines : [];
    if (!specs.length) return { ok: false, error: 'Debe existir al menos una línea de venta.' };

    const preparedLines = [];
    const requestedByVariant = new Map();
    for (const spec of specs) {
      const prepared = prepareSaleLine(current, spec);
      if (!prepared.ok) return prepared;
      const data = prepared.data;
      preparedLines.push(data);
      requestedByVariant.set(data.variant.id, (requestedByVariant.get(data.variant.id) || 0) + data.qty);
    }

    for (const [variantId, requested] of requestedByVariant.entries()) {
      const variant = current.variantes.find((item) => item.id === variantId);
      if (!variant || requested > availableStockForVariant(current, variantId)) {
        return { ok: false, error: `Stock disponible insuficiente para ${variant ? variantLabel(variant) : 'una variante seleccionada'}; puede existir mercadería reservada en apartados.` };
      }
    }

    const totals = preparedSaleTotals(preparedLines);
    if (!Number.isFinite(totals.net) || totals.net < 0) return { ok: false, error: 'El total de la venta no es válido.' };

    let initialPayment;
    if (type === 'credito') {
      const rawInitial = options.initialPayment === '' || options.initialPayment === null || typeof options.initialPayment === 'undefined' ? 0 : Number(options.initialPayment);
      if (!Number.isFinite(rawInitial) || rawInitial < 0) return { ok: false, error: 'El abono inicial debe ser un monto válido mayor o igual a cero.' };
      initialPayment = rawInitial;
    } else {
      initialPayment = totals.net;
    }
    if (initialPayment > totals.net) return { ok: false, error: 'El abono inicial no puede superar el total de la venta.' };

    const balance = type === 'credito' ? Math.max(0, totals.net - initialPayment) : 0;
    const now = new Date().toISOString();
    const number = saleNumber(current);
    const reference = saleReference(number);
    const saleId = uid('ven');
    const dueDate = type === 'credito' && options.dueDate ? String(options.dueDate) : null;
    const lineSnapshots = preparedLines.map((data) => ({
      id: uid('lin'),
      productId: data.product.id,
      variantId: data.variant.id,
      productName: data.product.name,
      productCode: data.product.internalCode || '',
      variantLabel: variantLabel(data.variant),
      quantity: data.qty,
      salePrice: data.salePrice,
      purchasePrice: data.purchasePrice,
      unitDiscount: data.unitDiscount,
      discountTotal: data.discountTotal,
      grossTotal: data.grossTotal,
      lineTotal: data.lineTotal,
      unitUtility: data.unitUtility,
      lineUtility: data.lineUtility
    }));

    let saveError = '';
    const saved = store.transact((draft) => {
      for (const [variantId, requested] of requestedByVariant.entries()) {
        const variant = draft.variantes.find((item) => item.id === variantId);
        if (!variant || requested > availableStockForVariant(draft, variantId)) {
          saveError = `Stock disponible insuficiente para ${variant ? variantLabel(variant) : 'una variante seleccionada'}; puede existir mercadería reservada en apartados.`;
          return;
        }
      }

      draft.ventas.push({
        id: saleId,
        saleNumber: number,
        reference,
        date: now,
        type,
        clientId,
        clientSnapshot: currentClient ? { id: currentClient.id, name: currentClient.name, phone: currentClient.phone } : null,
        paymentMethod: method,
        dueDate,
        subtotalBruto: totals.gross,
        discountTotal: totals.discounts,
        total: totals.net,
        initialPayment,
        totalPaid: initialPayment,
        balance,
        paymentStatus: balance <= 0.005 ? 'pagado' : (initialPayment > 0 ? 'abonado' : 'pendiente'),
        totalUtility: totals.utility,
        status: 'confirmada',
        lines: lineSnapshots,
        createdAt: now,
        updatedAt: now
      });

      preparedLines.forEach((data) => {
        const target = draft.variantes.find((item) => item.id === data.variant.id);
        const before = Number(target.stock) || 0;
        target.stock = before - data.qty;
        target.updatedAt = now;
        draft.movimientosInventario.push({
          id: uid('mov'),
          date: now,
          productId: data.product.id,
          variantId: data.variant.id,
          quantity: data.qty,
          type: 'salida',
          reason: 'Venta',
          note: reference,
          relatedSaleId: saleId,
          productNameSnapshot: data.product.name,
          variantLabelSnapshot: variantLabel(data.variant),
          stockBefore: before,
          stockAfter: target.stock,
          createdAt: now
        });
      });

      if (clientId && initialPayment > 0) {
        draft.cobros.push({
          id: uid('cob'),
          date: now,
          clientId,
          saleId,
          reference,
          amount: initialPayment,
          method,
          kind: type === 'contado' ? 'Pago de contado' : 'Abono inicial',
          status: 'confirmado',
          source: 'venta',
          createdAt: now
        });
      }
    });

    if (saveError || !saved) return { ok: false, error: saveError || 'No se pudo guardar la venta.' };
    return { ok: true, saleId, reference, totals, initialPayment, balance };
  }

  function openSaleForm() {
    const state = store.getState();
    const sellableProducts = state.productos.filter((product) => product.active && productVariants(state, product.id).length);
    if (!sellableProducts.length) {
      showToast('Primero agrega un producto activo con al menos una variante.', 'error');
      return;
    }

    const clients = state.clientes.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
    openModal(`
      <form id="saleForm" novalidate>
        <div class="modal-header">
          <div>
            <p class="modal-eyebrow">VENTAS</p>
            <h2 id="modalTitle">Nueva venta</h2>
            <p>La fecha y hora se guardan automáticamente al confirmar. El descuento es un monto fijo por pieza, nunca un porcentaje.</p>
          </div>
          <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body">
          <section class="sale-form-section">
            <div class="fields-grid fields-grid--3">
              <label class="field-group">
                <span>Tipo de venta *</span>
                <select id="saleType" required>
                  <option value="contado">Contado</option>
                  <option value="credito">Crédito</option>
                </select>
              </label>
              <label class="field-group">
                <span>Cliente <small id="saleClientRequirement">(opcional)</small></span>
                <select id="saleClient">
                  <option value="">Cliente de contado / sin ficha</option>
                  ${clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)} · ${escapeHtml(client.phone || '')}</option>`).join('')}
                </select>
              </label>
              <label class="field-group">
                <span>Método de pago *</span>
                <select id="salePaymentMethod" required>${PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('')}</select>
              </label>
            </div>
          </section>

          <section class="sale-form-section">
            <div class="form-section__heading">
              <div><h3>Productos</h3><p>Selecciona la variante exacta y la cantidad.</p></div>
              <button class="button button--secondary button--compact" type="button" data-action="add-sale-line">＋ Agregar línea</button>
            </div>
            <div class="sale-lines" id="saleLines">${saleLineEditorTemplate(state)}</div>
          </section>

          <section class="sale-form-section sale-credit-section" id="saleCreditSection" hidden>
            <div class="fields-grid fields-grid--2">
              <label class="field-group">
                <span>Abono inicial</span>
                <div class="money-input"><span>C$</span><input id="saleInitialPayment" type="number" min="0" step="0.01" inputmode="decimal"></div>
              </label>
              <label class="field-group">
                <span>Fecha de vencimiento <small>(opcional)</small></span>
                <input id="saleDueDate" type="date">
              </label>
            </div>
          </section>

          <section class="sale-totals-panel" aria-label="Totales de la venta">
            <div><span>Subtotal bruto</span><strong id="saleGrossTotal">${money(0)}</strong></div>
            <div><span>Descuentos</span><strong id="saleDiscountTotal">${money(0)}</strong></div>
            <div class="sale-total-accent"><span>Total neto</span><strong id="saleNetTotal">${money(0)}</strong></div>
            <div><span>Pagado / abono</span><strong id="salePaidTotal">${money(0)}</strong></div>
            <div><span>Saldo pendiente</span><strong id="saleBalanceTotal">${money(0)}</strong></div>
            <div><span>Utilidad real</span><strong id="saleUtilityTotal">${money(0)}</strong></div>
          </section>
        </div>
        <div class="modal-footer">
          <button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button>
          <button class="button button--primary" type="submit">Confirmar venta</button>
        </div>
      </form>`, 'modal--sale');

    const form = document.getElementById('saleForm');
    const linesRoot = document.getElementById('saleLines');
    const typeSelect = document.getElementById('saleType');
    const clientSelect = document.getElementById('saleClient');
    const clientRequirement = document.getElementById('saleClientRequirement');
    const creditSection = document.getElementById('saleCreditSection');
    const initialPaymentInput = document.getElementById('saleInitialPayment');

    const lineDataFromElement = (row) => {
      const current = store.getState();
      const productId = row.querySelector('[data-sale-product]')?.value || '';
      const variantId = row.querySelector('[data-sale-variant]')?.value || '';
      const product = current.productos.find((item) => item.id === productId);
      const variant = current.variantes.find((item) => item.id === variantId && item.productId === productId);
      const qty = Math.max(0, Number.parseInt(row.querySelector('[data-sale-qty]')?.value, 10) || 0);
      const unitDiscount = Math.max(0, Number(row.querySelector('[data-sale-discount]')?.value) || 0);
      if (!product || !variant) return null;
      const salePrice = effectiveVariantSalePrice(product, variant);
      const purchasePrice = effectiveVariantPurchasePrice(product, variant);
      const grossTotal = salePrice * qty;
      const discountTotal = unitDiscount * qty;
      const lineTotal = qty * (salePrice - unitDiscount);
      const unitUtility = (salePrice - unitDiscount) - purchasePrice;
      const lineUtility = unitUtility * qty;
      return { product, variant, qty, unitDiscount, salePrice, purchasePrice, grossTotal, discountTotal, lineTotal, unitUtility, lineUtility };
    };

    const refreshLineVariants = (row, preferredVariantId = '') => {
      const current = store.getState();
      const productSelect = row.querySelector('[data-sale-product]');
      const variantSelect = row.querySelector('[data-sale-variant]');
      const variants = productVariants(current, productSelect.value);
      variantSelect.innerHTML = variants.map((variant) => `<option value="${variant.id}" ${variant.id === preferredVariantId ? 'selected' : ''}>${escapeHtml(variantLabel(variant))} · ${quantity(availableStockForVariant(state, variant.id))} disponibles</option>`).join('');
      refreshLine(row);
    };

    const refreshLine = (row) => {
      const data = lineDataFromElement(row);
      if (!data) return;
      row.querySelector('[data-sale-price]').textContent = money(data.salePrice);
      row.querySelector('[data-sale-stock]').textContent = quantity(availableStockForVariant(store.getState(), data.variant.id));
      row.querySelector('[data-sale-discount-total]').textContent = money(data.discountTotal);
      row.querySelector('[data-sale-line-total]').textContent = money(data.lineTotal);
      const utility = row.querySelector('[data-sale-line-utility]');
      utility.textContent = money(data.lineUtility);
      utility.classList.toggle('negative-value', data.lineUtility < 0);
      row.classList.toggle('sale-line-editor--invalid', data.qty > availableStockForVariant(store.getState(), data.variant.id) || data.unitDiscount > data.salePrice);
    };

    const refreshTotals = () => {
      let gross = 0;
      let discounts = 0;
      let net = 0;
      let utility = 0;
      [...linesRoot.querySelectorAll('[data-sale-line]')].forEach((row) => {
        refreshLine(row);
        const data = lineDataFromElement(row);
        if (!data) return;
        gross += data.grossTotal;
        discounts += data.discountTotal;
        net += data.lineTotal;
        utility += data.lineUtility;
      });
      const credit = typeSelect.value === 'credito';
      const initial = credit ? Math.max(0, Number(initialPaymentInput.value) || 0) : Math.max(0, net);
      const paid = Math.min(initial, Math.max(0, net));
      const balance = credit ? Math.max(0, net - paid) : 0;
      document.getElementById('saleGrossTotal').textContent = money(gross);
      document.getElementById('saleDiscountTotal').textContent = money(discounts);
      document.getElementById('saleNetTotal').textContent = money(net);
      document.getElementById('salePaidTotal').textContent = money(paid);
      document.getElementById('saleBalanceTotal').textContent = money(balance);
      const utilityEl = document.getElementById('saleUtilityTotal');
      utilityEl.textContent = money(utility);
      utilityEl.classList.toggle('negative-value', utility < 0);
      return { gross, discounts, net, utility, paid, balance };
    };

    const refreshType = () => {
      const credit = typeSelect.value === 'credito';
      creditSection.hidden = !credit;
      clientRequirement.textContent = credit ? '(obligatorio)' : '(opcional)';
      clientSelect.required = credit;
      if (!credit) initialPaymentInput.value = '';
      refreshTotals();
    };

    const initializeRow = (row) => refreshLineVariants(row);
    initializeRow(linesRoot.querySelector('[data-sale-line]'));

    form.addEventListener('click', (event) => {
      const actionTarget = event.target.closest('[data-action]');
      if (!actionTarget) return;
      if (actionTarget.dataset.action === 'add-sale-line') {
        linesRoot.insertAdjacentHTML('beforeend', saleLineEditorTemplate(store.getState()));
        initializeRow(linesRoot.lastElementChild);
        refreshTotals();
      }
      if (actionTarget.dataset.action === 'remove-sale-line') {
        const rows = linesRoot.querySelectorAll('[data-sale-line]');
        if (rows.length <= 1) {
          showToast('Debe quedar al menos una línea de venta.', 'error');
          return;
        }
        actionTarget.closest('[data-sale-line]')?.remove();
        refreshTotals();
      }
    });

    form.addEventListener('change', (event) => {
      const row = event.target.closest('[data-sale-line]');
      if (event.target.matches('[data-sale-product]') && row) refreshLineVariants(row);
      if (event.target.matches('[data-sale-variant]') && row) refreshLine(row);
      if (event.target === typeSelect) refreshType();
      refreshTotals();
    });
    form.addEventListener('input', (event) => {
      if (event.target.closest('[data-sale-line]') || event.target === initialPaymentInput) refreshTotals();
    });
    refreshType();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const lineSpecs = [...linesRoot.querySelectorAll('[data-sale-line]')].map((row) => ({
        productId: row.querySelector('[data-sale-product]')?.value || '',
        variantId: row.querySelector('[data-sale-variant]')?.value || '',
        quantity: row.querySelector('[data-sale-qty]')?.value || '',
        unitDiscount: row.querySelector('[data-sale-discount]')?.value || '0'
      }));
      const result = commitSale({
        type: typeSelect.value,
        clientId: clientSelect.value || null,
        method: document.getElementById('salePaymentMethod').value,
        dueDate: document.getElementById('saleDueDate').value || null,
        initialPayment: initialPaymentInput.value,
        lines: lineSpecs
      });
      if (!result.ok) {
        showToast(result.error, 'error');
        if (result.error.includes('requiere un cliente')) clientSelect.focus();
        return;
      }
      closeModal();
      renderRoute();
      showToast(`${result.reference} confirmada correctamente.`);
    });
  }

  function openSaleDetail(saleId) {
    const state = store.getState();
    const sale = state.ventas.find((item) => item.id === saleId);
    if (!sale) {
      showToast('No se encontró la venta.', 'error');
      return;
    }
    const lines = sale.lines || [];
    const financial = saleFinancialState(state, sale);
    const credit = String(sale.type || '').toLowerCase() === 'credito';
    const paymentRows = financial.payments.length
      ? financial.payments.map((payment) => `
          <div class="payment-history-row">
            <div><strong>${formatDate(payment.date || payment.createdAt)}</strong><span>${escapeHtml(payment.kind || 'Abono')} · ${escapeHtml(payment.method || '—')}</span></div>
            <strong>${money(numericValue(payment, ['amount', 'monto', 'total', 'importe']))}</strong>
          </div>`).join('')
      : '<div class="client-history-empty">Sin pagos registrados para esta venta.</div>';
    const postSaleOperations = state.operacionesPostVenta
      .filter((operation) => String(operation.saleId || '') === String(sale.id) && !isPostSaleOperationCancelled(operation))
      .slice()
      .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
    openModal(`
      <div class="modal-header">
        <div>
          <p class="modal-eyebrow">VENTA CONFIRMADA</p>
          <h2 id="modalTitle">${escapeHtml(sale.reference || sale.id)}</h2>
          <p>${formatDate(sale.date || sale.createdAt, true)} · ${credit ? 'Crédito' : 'Contado'} · ${escapeHtml(saleClientName(state, sale))}</p>
        </div>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body">
        <div class="sale-detail-meta">
          <div><span>Método inicial</span><strong>${escapeHtml(sale.paymentMethod || '—')}</strong></div>
          <div><span>Pagado</span><strong>${money(financial.paid)}</strong></div>
          <div><span>Saldo</span><strong>${money(financial.balance)}</strong></div>
          <div><span>Estado</span><strong><span class="status-pill status-pill--${statusClass(financial.statusKey)}">${financial.status}</span></strong></div>
          <div><span>Vencimiento</span><strong>${sale.dueDate ? formatDate(`${sale.dueDate}T12:00:00`) : '—'}</strong></div>
        </div>
        <div class="sale-detail-lines">
          ${lines.map((line) => `
            <article class="sale-detail-line">
              <div><strong>${escapeHtml(line.productName || 'Producto')}</strong><span>${escapeHtml(line.variantLabel || 'Variante histórica')} · ${quantity(line.quantity)} pieza${Number(line.quantity) === 1 ? '' : 's'}</span></div>
              <div><span>Precio</span><strong>${money(line.salePrice)}</strong></div>
              <div><span>Desc./pieza</span><strong>${money(line.unitDiscount)}</strong></div>
              <div><span>Desc. total</span><strong>${money(line.discountTotal)}</strong></div>
              <div><span>Total línea</span><strong>${money(line.lineTotal)}</strong></div>
              <div><span>Utilidad</span><strong class="${Number(line.lineUtility) < 0 ? 'negative-value' : ''}">${money(line.lineUtility)}</strong></div>
            </article>`).join('')}
        </div>
        <section class="sale-totals-panel sale-totals-panel--detail">
          <div><span>Subtotal bruto</span><strong>${money(numericValue(sale, ['subtotalBruto']))}</strong></div>
          <div><span>Descuentos</span><strong>${money(numericValue(sale, ['discountTotal']))}</strong></div>
          <div class="sale-total-accent"><span>Total neto</span><strong>${money(financial.total)}</strong></div>
          <div><span>Utilidad real</span><strong class="${numericValue(sale, ['totalUtility']) < 0 ? 'negative-value' : ''}">${money(numericValue(sale, ['totalUtility']))}</strong></div>
        </section>
        ${credit ? `
          <section class="payment-history-block">
            <div class="payment-history-heading"><h3>Historial de abonos</h3><span>${quantity(financial.payments.length)}</span></div>
            <div class="payment-history-list">${paymentRows}</div>
          </section>` : ''}
        ${postSaleOperations.length ? `
          <section class="payment-history-block">
            <div class="payment-history-heading"><h3>Cambios y devoluciones</h3><span>${quantity(postSaleOperations.length)}</span></div>
            <div class="payment-history-list">${postSaleOperations.map((operation) => `<div class="payment-history-row"><div><strong>${escapeHtml(operation.reference || operation.id)} · ${postSaleTypeLabel(operation.type)}</strong><span>${formatDate(operation.date || operation.createdAt)} · ${escapeHtml(operation.sourceProductName || 'Producto')}</span></div><button class="button button--secondary button--compact" type="button" data-action="view-post-sale" data-operation-id="${operation.id}">Ver</button></div>`).join('')}</div>
          </section>` : ''}
        <p class="sale-history-note">La venta original y sus snapshots históricos no se modifican de forma destructiva al registrar cobros, cambios o devoluciones.</p>
      </div>
      <div class="modal-footer">
        ${credit && financial.balance > 0.005 ? `<button class="button button--primary" type="button" data-action="collect-sale" data-sale-id="${sale.id}">Registrar cobro</button>` : ''}
        <button class="button button--secondary" type="button" data-action="close-modal">Cerrar</button>
      </div>
    `, 'modal--large');
  }

  function collectionSummary(state) {
    const creditSales = state.ventas.filter((sale) => String(sale.type || '').toLowerCase() === 'credito' && !isSaleCancelled(sale));
    const financials = creditSales.map((sale) => saleFinancialState(state, sale));
    return {
      receivable: financials.reduce((sum, item) => sum + item.balance, 0),
      active: financials.filter((item) => item.balance > 0.005).length,
      overdue: financials.filter((item) => item.statusKey === 'vencido').length,
      payments: state.cobros.filter((payment) => !isPaymentCancelled(payment)).length
    };
  }

  function renderCollections(module) {
    const state = store.getState();
    const summary = collectionSummary(state);
    const search = collectionSearch.trim().toLowerCase();
    const sales = state.ventas
      .filter((sale) => String(sale.type || '').toLowerCase() === 'credito' && !isSaleCancelled(sale))
      .slice()
      .sort((a, b) => {
        const fa = saleFinancialState(state, a);
        const fb = saleFinancialState(state, b);
        const priority = { vencido: 0, abonado: 1, pendiente: 2, pagado: 3 };
        const pa = priority[fa.statusKey] ?? 9;
        const pb = priority[fb.statusKey] ?? 9;
        if (pa !== pb) return pa - pb;
        return new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime();
      })
      .filter((sale) => {
        const financial = saleFinancialState(state, sale);
        if (collectionStatusFilter === 'por-cobrar' && financial.balance <= 0.005) return false;
        if (!['todos', 'por-cobrar'].includes(collectionStatusFilter) && financial.statusKey !== collectionStatusFilter) return false;
        if (!search) return true;
        const haystack = [sale.reference, saleClientName(state, sale), sale.clientSnapshot?.phone, financial.status].join(' ').toLowerCase();
        return haystack.includes(search);
      });

    return `
      <section class="page-panel collections-page" aria-labelledby="pageTitle">
        <div class="page-heading collections-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div>
              <h1 id="pageTitle">Cobros</h1>
              <p>Cuentas por cobrar, abonos, pagos completos y vencimientos derivados desde cada venta al crédito.</p>
            </div>
          </div>
          <span class="stage-chip">V1</span>
        </div>

        <section class="collections-summary" aria-label="Resumen de cuentas por cobrar">
          <article class="metric-card metric-card--accent"><span>Saldo por cobrar</span><strong>${money(summary.receivable)}</strong></article>
          <article class="metric-card"><span>Deudas activas</span><strong>${quantity(summary.active)}</strong></article>
          <article class="metric-card"><span>Vencidas</span><strong>${quantity(summary.overdue)}</strong></article>
          <article class="metric-card"><span>Cobros registrados</span><strong>${quantity(summary.payments)}</strong></article>
        </section>

        <div class="collections-toolbar">
          <label class="search-field collections-search">
            <span class="sr-only">Buscar cliente o venta</span>
            <input id="collectionSearch" type="search" value="${escapeHtml(collectionSearch)}" placeholder="Buscar cliente, teléfono o venta…" autocomplete="off">
          </label>
          <label class="select-field">
            <span>Estado</span>
            <select id="collectionStatusFilter">
              <option value="por-cobrar" ${collectionStatusFilter === 'por-cobrar' ? 'selected' : ''}>Por cobrar</option>
              <option value="todos" ${collectionStatusFilter === 'todos' ? 'selected' : ''}>Todos</option>
              <option value="pendiente" ${collectionStatusFilter === 'pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="abonado" ${collectionStatusFilter === 'abonado' ? 'selected' : ''}>Abonado</option>
              <option value="vencido" ${collectionStatusFilter === 'vencido' ? 'selected' : ''}>Vencido</option>
              <option value="pagado" ${collectionStatusFilter === 'pagado' ? 'selected' : ''}>Pagado</option>
            </select>
          </label>
        </div>

        <div class="collections-list-heading">
          <div><h2>Ventas al crédito</h2><p>${quantity(sales.length)} deuda${sales.length === 1 ? '' : 's'} visible${sales.length === 1 ? '' : 's'}</p></div>
        </div>
        <div class="collections-list" aria-live="polite">
          ${sales.length ? sales.map((sale) => renderDebtRow(state, sale)).join('') : `
            <div class="collections-empty">
              <span class="collections-empty__mark" aria-hidden="true">◎</span>
              <h3>${state.ventas.some((sale) => String(sale.type || '').toLowerCase() === 'credito') ? 'Sin coincidencias' : 'Aún no hay ventas al crédito'}</h3>
              <p>${state.ventas.some((sale) => String(sale.type || '').toLowerCase() === 'credito') ? 'Cambia la búsqueda o el filtro de estado.' : 'Las deudas aparecerán aquí automáticamente cuando registres una venta al crédito.'}</p>
            </div>`}
        </div>
      </section>
      <div id="modalRoot"></div>
    `;
  }

  function renderDebtRow(state, sale) {
    const financial = saleFinancialState(state, sale);
    const client = state.clientes.find((item) => item.id === sale.clientId);
    return `
      <article class="debt-row">
        <div class="debt-row__identity">
          <strong>${escapeHtml(saleClientName(state, sale))}</strong>
          <span>${escapeHtml(client?.phone || sale.clientSnapshot?.phone || 'Sin teléfono')} · ${escapeHtml(sale.reference || sale.id)}</span>
        </div>
        <div class="debt-row__money"><span>Total</span><strong>${money(financial.total)}</strong></div>
        <div class="debt-row__money"><span>Pagado</span><strong>${money(financial.paid)}</strong></div>
        <div class="debt-row__money debt-row__balance"><span>Saldo</span><strong>${money(financial.balance)}</strong></div>
        <div class="debt-row__due"><span>Vence</span><strong>${sale.dueDate ? formatDate(`${sale.dueDate}T12:00:00`) : 'Sin fecha'}</strong></div>
        <div class="debt-row__status"><span class="status-pill status-pill--${statusClass(financial.statusKey)}">${financial.status}</span></div>
        <div class="debt-row__actions">
          <button class="button button--secondary button--compact" type="button" data-action="view-debt" data-sale-id="${sale.id}">Historial</button>
          ${financial.balance > 0.005 ? `<button class="button button--primary button--compact" type="button" data-action="collect-sale" data-sale-id="${sale.id}">Cobrar</button>` : ''}
        </div>
      </article>`;
  }

  function openDebtDetail(saleId) {
    const state = store.getState();
    const sale = state.ventas.find((item) => item.id === saleId && String(item.type || '').toLowerCase() === 'credito');
    if (!sale) {
      showToast('No se encontró la deuda seleccionada.', 'error');
      return;
    }
    const financial = saleFinancialState(state, sale);
    const rows = financial.payments.length
      ? financial.payments.map((payment) => `
          <div class="payment-history-row">
            <div><strong>${formatDate(payment.date || payment.createdAt)}</strong><span>${escapeHtml(payment.kind || 'Abono')} · ${escapeHtml(payment.method || '—')}${payment.observation ? ` · ${escapeHtml(payment.observation)}` : ''}</span></div>
            <strong>${money(numericValue(payment, ['amount', 'monto', 'total', 'importe']))}</strong>
          </div>`).join('')
      : '<div class="client-history-empty">Esta venta todavía no tiene abonos.</div>';
    openModal(`
      <div class="modal-header">
        <div>
          <p class="modal-eyebrow">CUENTA POR COBRAR</p>
          <h2 id="modalTitle">${escapeHtml(sale.reference || sale.id)}</h2>
          <p>${escapeHtml(saleClientName(state, sale))} · Venta ${formatDate(sale.date || sale.createdAt)}</p>
        </div>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body">
        <section class="debt-detail-summary">
          <div><span>Total venta</span><strong>${money(financial.total)}</strong></div>
          <div><span>Total pagado</span><strong>${money(financial.paid)}</strong></div>
          <div class="debt-detail-summary__accent"><span>Saldo pendiente</span><strong>${money(financial.balance)}</strong></div>
          <div><span>Estado</span><strong><span class="status-pill status-pill--${statusClass(financial.statusKey)}">${financial.status}</span></strong></div>
          <div><span>Vencimiento</span><strong>${sale.dueDate ? formatDate(`${sale.dueDate}T12:00:00`) : '—'}</strong></div>
        </section>
        <section class="payment-history-block">
          <div class="payment-history-heading"><h3>Historial de abonos</h3><span>${quantity(financial.payments.length)}</span></div>
          <div class="payment-history-list">${rows}</div>
        </section>
      </div>
      <div class="modal-footer">
        ${financial.balance > 0.005 ? `<button class="button button--primary" type="button" data-action="collect-sale" data-sale-id="${sale.id}">Registrar cobro</button>` : ''}
        <button class="button button--secondary" type="button" data-action="close-modal">Cerrar</button>
      </div>
    `, 'modal--medium');
  }

  function commitPayment(options) {
    const current = store.getState();
    const sale = current.ventas.find((item) => item.id === options.saleId);
    if (!sale || String(sale.type || '').toLowerCase() !== 'credito' || isSaleCancelled(sale)) {
      return { ok: false, error: 'La venta seleccionada no está disponible para cobro.' };
    }
    const financial = saleFinancialState(current, sale);
    if (financial.balance <= 0.005) return { ok: false, error: 'Esta venta ya está pagada.' };

    const method = String(options.method || '');
    if (!PAYMENT_METHODS.includes(method)) return { ok: false, error: 'Selecciona un método de pago válido.' };
    const dateKey = String(options.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { ok: false, error: 'Selecciona una fecha de cobro válida.' };
    if (dateKey > localDateKey()) return { ok: false, error: 'La fecha de cobro no puede estar en el futuro.' };

    const fullPayment = options.kind === 'completo';
    const amount = fullPayment ? financial.balance : Number(options.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'El monto del abono debe ser mayor que cero.' };
    if (amount - financial.balance > 0.005) return { ok: false, error: `El abono no puede superar el saldo de ${money(financial.balance)}.` };

    const normalizedAmount = Math.min(financial.balance, Math.round((amount + Number.EPSILON) * 100) / 100);
    const afterPaid = Math.min(financial.total, financial.paid + normalizedAmount);
    const afterBalance = Math.max(0, financial.total - afterPaid);
    const now = new Date().toISOString();
    const paymentId = uid('cob');
    const paymentDate = `${dateKey}T12:00:00`;
    const kind = afterBalance <= 0.005 ? 'Pago completo' : 'Abono';

    const saved = store.transact((draft) => {
      draft.cobros.push({
        id: paymentId,
        date: paymentDate,
        clientId: sale.clientId,
        saleId: sale.id,
        reference: sale.reference || sale.id,
        amount: normalizedAmount,
        method,
        kind,
        observation: String(options.observation || '').trim(),
        status: 'confirmado',
        source: 'cobros',
        createdAt: now
      });
      const target = draft.ventas.find((item) => item.id === sale.id);
      if (target) {
        target.totalPaid = afterPaid;
        target.balance = afterBalance;
        target.paymentStatus = afterBalance <= 0.005 ? 'pagado' : 'abonado';
        target.updatedAt = now;
      }
    });
    if (!saved) return { ok: false, error: 'No se pudo guardar el cobro.' };
    return { ok: true, paymentId, amount: normalizedAmount, balance: afterBalance, kind };
  }

  function openPaymentForm(saleId) {
    const state = store.getState();
    const sale = state.ventas.find((item) => item.id === saleId && String(item.type || '').toLowerCase() === 'credito');
    if (!sale) {
      showToast('No se encontró la venta seleccionada.', 'error');
      return;
    }
    const financial = saleFinancialState(state, sale);
    if (financial.balance <= 0.005) {
      showToast('Esta venta ya está pagada.', 'error');
      return;
    }
    const today = localDateKey();
    openModal(`
      <form id="paymentForm" novalidate>
        <div class="modal-header">
          <div>
            <p class="modal-eyebrow">COBROS</p>
            <h2 id="modalTitle">Registrar cobro</h2>
            <p>${escapeHtml(saleClientName(state, sale))} · ${escapeHtml(sale.reference || sale.id)}</p>
          </div>
          <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body">
          <section class="payment-balance-strip">
            <div><span>Total venta</span><strong>${money(financial.total)}</strong></div>
            <div><span>Pagado</span><strong>${money(financial.paid)}</strong></div>
            <div class="payment-balance-strip__accent"><span>Saldo</span><strong>${money(financial.balance)}</strong></div>
          </section>
          <div class="fields-grid fields-grid--2 payment-form-fields">
            <label class="field-group">
              <span>Fecha *</span>
              <input id="paymentDate" type="date" value="${today}" max="${today}" required>
            </label>
            <label class="field-group">
              <span>Tipo *</span>
              <select id="paymentKind" required>
                <option value="abono">Abono</option>
                <option value="completo">Pago completo</option>
              </select>
            </label>
            <label class="field-group">
              <span>Monto *</span>
              <div class="money-input"><span>C$</span><input id="paymentAmount" type="number" min="0.01" max="${financial.balance.toFixed(2)}" step="0.01" inputmode="decimal" required></div>
            </label>
            <label class="field-group">
              <span>Método de pago *</span>
              <select id="paymentMethod" required>${PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('')}</select>
            </label>
            <label class="field-group field-group--wide">
              <span>Observación <small>(opcional)</small></span>
              <textarea id="paymentObservation" rows="3" maxlength="400"></textarea>
            </label>
          </div>
          <p class="form-hint">El sobrepago está bloqueado. Registrar un cobro no modifica la fecha original de la venta.</p>
        </div>
        <div class="modal-footer">
          <button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button>
          <button class="button button--primary" type="submit">Guardar cobro</button>
        </div>
      </form>
    `, 'modal--medium');

    const form = document.getElementById('paymentForm');
    const kindSelect = document.getElementById('paymentKind');
    const amountInput = document.getElementById('paymentAmount');
    const syncKind = () => {
      const full = kindSelect.value === 'completo';
      amountInput.readOnly = full;
      if (full) amountInput.value = financial.balance.toFixed(2);
      else if (Number(amountInput.value) > financial.balance) amountInput.value = '';
    };
    kindSelect.addEventListener('change', syncKind);
    syncKind();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = commitPayment({
        saleId,
        date: document.getElementById('paymentDate').value,
        kind: kindSelect.value,
        amount: amountInput.value,
        method: document.getElementById('paymentMethod').value,
        observation: document.getElementById('paymentObservation').value
      });
      if (!result.ok) {
        showToast(result.error, 'error');
        return;
      }
      closeModal();
      renderRoute();
      showToast(`${result.kind} registrado. Saldo: ${money(result.balance)}.`);
    });
  }

  // ===== Etapa 6/10 · Compras + Proveedores + Cuentas por pagar =====
  function providerMatchesRecord(record, providerId) {
    return String(record?.providerId || record?.proveedorId || '') === String(providerId);
  }

  function isSupplierPaymentCancelled(payment) {
    return ['anulado', 'anulada', 'cancelado', 'cancelada'].includes(String(payment?.status || payment?.estado || '').toLowerCase());
  }

  function isPurchaseCancelled(purchase) {
    return ['anulado', 'anulada', 'cancelado', 'cancelada'].includes(String(purchase?.status || purchase?.estado || '').toLowerCase());
  }

  function supplierPaymentHistoryForPurchase(state, purchaseId) {
    return state.pagosProveedores
      .filter((payment) => String(payment.purchaseId || payment.compraId || '') === String(purchaseId))
      .filter((payment) => !isSupplierPaymentCancelled(payment))
      .slice()
      .sort((a, b) => new Date(a.date || a.fecha || a.createdAt || 0).getTime() - new Date(b.date || b.fecha || b.createdAt || 0).getTime());
  }

  function purchaseFinancialState(state, purchase, todayKey = localDateKey()) {
    const total = Math.max(0, numericValue(purchase, ['total', 'totalCompra', 'importe']));
    const payments = supplierPaymentHistoryForPurchase(state, purchase.id);
    const linkedPaid = payments.reduce((sum, payment) => sum + numericValue(payment, ['amount', 'monto', 'total', 'importe']), 0);
    const legacyInitial = Math.max(0, numericValue(purchase, ['initialPayment', 'pagoInicial', 'abonoInicial']));
    const paid = Math.min(total, Math.max(0, payments.length ? linkedPaid : legacyInitial));
    const balance = Math.max(0, total - paid);
    const type = String(purchase.type || purchase.tipo || 'contado').toLowerCase();
    const dueDate = purchase.dueDate ? String(purchase.dueDate).slice(0, 10) : '';
    let status = 'Pendiente';
    let statusKey = 'pendiente';

    if (isPurchaseCancelled(purchase)) {
      status = 'Anulada';
      statusKey = 'anulada';
    } else if (type !== 'credito' || balance <= 0.005) {
      status = 'Pagado';
      statusKey = 'pagado';
    } else if (dueDate && dueDate < todayKey) {
      status = 'Vencido';
      statusKey = 'vencido';
    } else if (paid > 0.005) {
      status = 'Abonado';
      statusKey = 'abonado';
    }

    return { total, paid, balance, status, statusKey, dueDate, payments };
  }

  function providerStats(state, providerId) {
    const purchases = state.compras
      .filter((purchase) => providerMatchesRecord(purchase, providerId))
      .filter((purchase) => !isPurchaseCancelled(purchase));
    const payments = state.pagosProveedores
      .filter((payment) => providerMatchesRecord(payment, providerId))
      .filter((payment) => !isSupplierPaymentCancelled(payment));
    const totalPurchased = purchases.reduce((sum, purchase) => sum + purchaseFinancialState(state, purchase).total, 0);
    const totalPaid = purchases.reduce((sum, purchase) => sum + purchaseFinancialState(state, purchase).paid, 0);
    const balance = purchases.reduce((sum, purchase) => sum + purchaseFinancialState(state, purchase).balance, 0);
    return {
      totalPurchased,
      totalPaid,
      balance,
      purchases: purchases.slice().sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime()),
      payments: payments.slice().sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
    };
  }

  function purchaseNumber(state) {
    const max = state.compras.reduce((value, purchase) => Math.max(value, Number(purchase.purchaseNumber) || 0), 0);
    return max + 1;
  }

  function purchaseReference(number) {
    return `COM-${String(number).padStart(6, '0')}`;
  }

  function purchaseProviderName(state, purchase) {
    const provider = state.proveedores.find((item) => item.id === purchase.providerId);
    return provider?.name || purchase.providerSnapshot?.name || 'Proveedor histórico';
  }

  function purchaseProductLabel(state, purchase) {
    const product = state.productos.find((item) => item.id === purchase.productId);
    const variant = state.variantes.find((item) => item.id === purchase.variantId);
    const productName = product?.name || purchase.productNameSnapshot || 'Producto histórico';
    const vLabel = variant ? variantLabel(variant) : (purchase.variantLabelSnapshot || 'Variante histórica');
    return `${productName} · ${vLabel}`;
  }

  function purchasesSummary(state) {
    const confirmed = state.compras.filter((purchase) => !isPurchaseCancelled(purchase));
    const financials = confirmed.map((purchase) => purchaseFinancialState(state, purchase));
    return {
      total: financials.reduce((sum, item) => sum + item.total, 0),
      payable: financials.reduce((sum, item) => sum + item.balance, 0),
      overdue: financials.filter((item) => item.statusKey === 'vencido').length,
      payments: state.pagosProveedores.filter((payment) => !isSupplierPaymentCancelled(payment)).length
    };
  }

  function renderProviders(module) {
    const state = store.getState();
    if (selectedProviderId) {
      const provider = state.proveedores.find((item) => item.id === selectedProviderId);
      if (provider) return renderProviderDetail(module, state, provider);
      selectedProviderId = null;
    }

    const search = providerSearch.trim().toLowerCase();
    const providers = state.proveedores
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }))
      .filter((provider) => {
        if (!search) return true;
        return [provider.name, provider.phone, provider.address].join(' ').toLowerCase().includes(search);
      });

    return `
      <section class="page-panel providers-page" aria-labelledby="pageTitle">
        <div class="page-heading providers-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div>
              <h1 id="pageTitle">Proveedores</h1>
              <p>Ficha básica, compras, pagos y saldo pendiente por proveedor.</p>
            </div>
          </div>
          <span class="stage-chip">V1</span>
        </div>

        <div class="providers-toolbar">
          <label class="search-field providers-search">
            <span class="sr-only">Buscar proveedor</span>
            <input id="providerSearch" type="search" value="${escapeHtml(providerSearch)}" placeholder="Buscar nombre, teléfono o dirección…" autocomplete="off">
          </label>
          <button class="button button--primary" type="button" data-action="add-provider">＋ Proveedor</button>
        </div>

        <div class="providers-list-heading">
          <div><h2>Proveedores registrados</h2><p>${quantity(providers.length)} visibles · ${quantity(state.proveedores.length)} totales</p></div>
        </div>
        <div class="providers-list">
          ${providers.length ? providers.map((provider) => renderProviderRow(state, provider)).join('') : `
            <div class="providers-empty">
              <div class="providers-empty__mark">♢</div>
              <h3>${state.proveedores.length ? 'Sin coincidencias' : 'Aún no hay proveedores'}</h3>
              <p>${state.proveedores.length ? 'Prueba con otra búsqueda.' : 'Agrega el primer proveedor para registrar compras de contado o crédito.'}</p>
              ${state.proveedores.length ? '' : '<button class="button button--primary" type="button" data-action="add-provider">＋ Proveedor</button>'}
            </div>`}
        </div>
      </section>
      <div id="modalRoot"></div>
    `;
  }

  function renderProviderRow(state, provider) {
    const stats = providerStats(state, provider.id);
    return `
      <article class="provider-row">
        <div class="provider-row__identity">
          <div class="client-avatar" aria-hidden="true">${escapeHtml(clientInitials(provider.name))}</div>
          <div><h3>${escapeHtml(provider.name)}</h3><p>${escapeHtml(provider.phone || 'Sin teléfono')}${provider.address ? ` · ${escapeHtml(provider.address)}` : ''}</p></div>
        </div>
        <div class="provider-row__summary"><span>Compras</span><strong>${money(stats.totalPurchased)}</strong></div>
        <div class="provider-row__summary"><span>Saldo</span><strong>${money(stats.balance)}</strong></div>
        <div class="provider-row__actions">
          <button class="button button--secondary button--compact" type="button" data-action="view-provider" data-provider-id="${provider.id}">Consultar</button>
          <button class="button button--ghost button--compact" type="button" data-action="edit-provider" data-provider-id="${provider.id}">Editar</button>
        </div>
      </article>`;
  }

  function renderProviderDetail(module, state, provider) {
    const stats = providerStats(state, provider.id);
    const purchaseRows = stats.purchases.length ? stats.purchases.map((purchase) => {
      const financial = purchaseFinancialState(state, purchase);
      return `
        <div class="provider-history-row">
          <div><strong>${escapeHtml(purchase.reference || purchase.id)}</strong><span>${formatDate(purchase.date || purchase.createdAt)} · ${escapeHtml(purchaseProductLabel(state, purchase))}</span></div>
          <div class="provider-history-row__amount"><strong>${money(financial.total)}</strong><span>Saldo ${money(financial.balance)}</span></div>
          <span class="status-pill status-pill--${statusClass(financial.statusKey)}">${financial.status}</span>
          <button class="button button--ghost button--compact" type="button" data-action="view-purchase" data-purchase-id="${purchase.id}">Ver</button>
        </div>`;
    }).join('') : '<div class="client-history-empty">Todavía no existen compras para este proveedor.</div>';

    const paymentRows = stats.payments.length ? stats.payments.map((payment) => `
      <div class="client-history-row">
        <div><strong>${formatDate(payment.date || payment.createdAt)}</strong><span>${escapeHtml(payment.kind || 'Pago')} · ${escapeHtml(payment.method || '—')} · ${escapeHtml(payment.reference || '')}${payment.observation ? ` · ${escapeHtml(payment.observation)}` : ''}</span></div>
        <strong>${money(numericValue(payment, ['amount', 'monto', 'total', 'importe']))}</strong>
      </div>`).join('') : '<div class="client-history-empty">Todavía no existen pagos registrados.</div>';

    return `
      <section class="page-panel provider-detail-page" aria-labelledby="pageTitle">
        <div class="page-heading">
          <div class="page-heading__left">
            <button class="page-heading__icon page-heading__icon--button" type="button" data-action="providers-back" aria-label="Volver a proveedores">←</button>
            <div><h1 id="pageTitle">${escapeHtml(provider.name)}</h1><p>${escapeHtml(provider.phone || 'Sin teléfono')}${provider.address ? ` · ${escapeHtml(provider.address)}` : ''}</p></div>
          </div>
          <span class="stage-chip">Proveedor</span>
        </div>

        <section class="provider-detail-summary">
          <article><span>Total comprado</span><strong>${money(stats.totalPurchased)}</strong></article>
          <article><span>Total pagado</span><strong>${money(stats.totalPaid)}</strong></article>
          <article class="provider-detail-summary__accent"><span>Saldo pendiente</span><strong>${money(stats.balance)}</strong></article>
          <article><span>Compras</span><strong>${quantity(stats.purchases.length)}</strong></article>
        </section>

        <div class="provider-detail-actions">
          <button class="button button--primary" type="button" data-action="new-purchase" data-provider-id="${provider.id}">＋ Nueva compra</button>
          <button class="button button--secondary" type="button" data-action="edit-provider" data-provider-id="${provider.id}">Editar proveedor</button>
        </div>

        <div class="provider-contact-card">
          <div><span>Dirección</span><strong>${escapeHtml(provider.address || '—')}</strong></div>
          <div><span>Observación</span><strong>${escapeHtml(provider.observation || '—')}</strong></div>
        </div>

        <div class="provider-history-grid">
          <section class="client-history-card">
            <div class="client-history-heading"><h2>Compras</h2><span>${quantity(stats.purchases.length)}</span></div>
            <div class="provider-history-list">${purchaseRows}</div>
          </section>
          <section class="client-history-card">
            <div class="client-history-heading"><h2>Historial de pagos</h2><span>${quantity(stats.payments.length)}</span></div>
            <div class="client-history-list">${paymentRows}</div>
          </section>
        </div>
      </section>
      <div id="modalRoot"></div>
    `;
  }

  function openProviderForm(providerId = null) {
    const state = store.getState();
    const provider = providerId ? state.proveedores.find((item) => item.id === providerId) : null;
    if (providerId && !provider) {
      showToast('No se encontró el proveedor.', 'error');
      return;
    }

    openModal(`
      <form id="providerForm" novalidate>
        <div class="modal-header">
          <div><p class="modal-eyebrow">PROVEEDORES</p><h2 id="modalTitle">${provider ? 'Editar proveedor' : 'Agregar proveedor'}</h2><p>Datos básicos para relacionar compras, pagos y saldos.</p></div>
          <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body">
          <div class="fields-grid fields-grid--2">
            <label class="field-group field-group--wide"><span>Nombre *</span><input id="providerName" type="text" value="${escapeHtml(provider?.name || '')}" maxlength="120" required autocomplete="off"></label>
            <label class="field-group"><span>Teléfono *</span><input id="providerPhone" type="tel" value="${escapeHtml(provider?.phone || '')}" maxlength="40" required autocomplete="off"></label>
            <label class="field-group field-group--wide"><span>Dirección <small>(opcional)</small></span><input id="providerAddress" type="text" value="${escapeHtml(provider?.address || '')}" maxlength="220" autocomplete="off"></label>
            <label class="field-group field-group--wide"><span>Observación <small>(opcional)</small></span><textarea id="providerObservation" rows="3" maxlength="500">${escapeHtml(provider?.observation || '')}</textarea></label>
          </div>
        </div>
        <div class="modal-footer"><button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit">${provider ? 'Guardar cambios' : 'Guardar proveedor'}</button></div>
      </form>`, 'modal--medium');

    document.getElementById('providerForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const data = {
        name: document.getElementById('providerName').value.trim(),
        phone: document.getElementById('providerPhone').value.trim(),
        address: document.getElementById('providerAddress').value.trim(),
        observation: document.getElementById('providerObservation').value.trim()
      };
      if (!data.name || !data.phone) {
        showToast('Completa nombre y teléfono del proveedor.', 'error');
        return;
      }
      const now = new Date().toISOString();
      const success = store.transact((draft) => {
        if (provider) {
          const target = draft.proveedores.find((item) => item.id === provider.id);
          if (target) Object.assign(target, data, { updatedAt: now });
        } else {
          draft.proveedores.push({ id: uid('pro'), ...data, createdAt: now, updatedAt: now });
        }
      });
      if (!success) {
        showToast('No se pudo guardar el proveedor.', 'error');
        return;
      }
      closeModal();
      renderRoute();
      showToast(provider ? 'Proveedor actualizado.' : 'Proveedor creado.');
    });
  }

  function renderPurchases(module) {
    const state = store.getState();
    const summary = purchasesSummary(state);
    const search = purchaseSearch.trim().toLowerCase();
    const purchases = state.compras
      .filter((purchase) => !isPurchaseCancelled(purchase))
      .slice()
      .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
      .filter((purchase) => {
        const financial = purchaseFinancialState(state, purchase);
        if (purchaseTypeFilter !== 'todos' && String(purchase.type || '').toLowerCase() !== purchaseTypeFilter) return false;
        if (purchaseStatusFilter === 'por-pagar' && financial.balance <= 0.005) return false;
        if (!['todos', 'por-pagar'].includes(purchaseStatusFilter) && financial.statusKey !== purchaseStatusFilter) return false;
        if (!search) return true;
        const haystack = [purchase.reference, purchaseProviderName(state, purchase), purchaseProductLabel(state, purchase), financial.status].join(' ').toLowerCase();
        return haystack.includes(search);
      });

    return `
      <section class="page-panel purchases-page" aria-labelledby="pageTitle">
        <div class="page-heading purchases-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div><h1 id="pageTitle">Compras</h1><p>Ingreso de mercadería, cuentas por pagar y pagos a proveedores sin contabilidad formal.</p></div>
          </div>
          <span class="stage-chip">V1</span>
        </div>

        <section class="purchases-summary" aria-label="Resumen de compras">
          <article class="metric-card"><span>Total compras</span><strong>${money(summary.total)}</strong></article>
          <article class="metric-card metric-card--accent"><span>Saldo por pagar</span><strong>${money(summary.payable)}</strong></article>
          <article class="metric-card"><span>Vencidas</span><strong>${quantity(summary.overdue)}</strong></article>
          <article class="metric-card"><span>Pagos registrados</span><strong>${quantity(summary.payments)}</strong></article>
        </section>

        <div class="purchases-toolbar">
          <div class="purchases-toolbar__filters">
            <label class="search-field purchases-search"><span class="sr-only">Buscar compra</span><input id="purchaseSearch" type="search" value="${escapeHtml(purchaseSearch)}" placeholder="Buscar compra, proveedor o producto…" autocomplete="off"></label>
            <label class="select-field"><span>Tipo</span><select id="purchaseTypeFilter"><option value="todos" ${purchaseTypeFilter === 'todos' ? 'selected' : ''}>Todos</option><option value="contado" ${purchaseTypeFilter === 'contado' ? 'selected' : ''}>Contado</option><option value="credito" ${purchaseTypeFilter === 'credito' ? 'selected' : ''}>Crédito</option></select></label>
            <label class="select-field"><span>Estado</span><select id="purchaseStatusFilter"><option value="todos" ${purchaseStatusFilter === 'todos' ? 'selected' : ''}>Todos</option><option value="por-pagar" ${purchaseStatusFilter === 'por-pagar' ? 'selected' : ''}>Por pagar</option><option value="pendiente" ${purchaseStatusFilter === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="abonado" ${purchaseStatusFilter === 'abonado' ? 'selected' : ''}>Abonado</option><option value="vencido" ${purchaseStatusFilter === 'vencido' ? 'selected' : ''}>Vencido</option><option value="pagado" ${purchaseStatusFilter === 'pagado' ? 'selected' : ''}>Pagado</option></select></label>
          </div>
          <button class="button button--primary" type="button" data-action="new-purchase">＋ Nueva compra</button>
        </div>

        <div class="purchases-list-heading"><h2>Historial de compras</h2><p>${quantity(purchases.length)} visibles · ${quantity(state.compras.length)} totales</p></div>
        <div class="purchases-list">
          ${purchases.length ? purchases.map((purchase) => renderPurchaseRow(state, purchase)).join('') : `
            <div class="purchases-empty"><div class="purchases-empty__mark">◇</div><h3>${state.compras.length ? 'Sin coincidencias' : 'Aún no hay compras'}</h3><p>${state.compras.length ? 'Cambia los filtros para ver otros registros.' : 'Registra la primera compra. La existencia aumentará únicamente al guardar.'}</p>${state.compras.length ? '' : '<button class="button button--primary" type="button" data-action="new-purchase">＋ Nueva compra</button>'}</div>`}
        </div>
      </section>
      <div id="modalRoot"></div>
    `;
  }

  function renderPurchaseRow(state, purchase) {
    const financial = purchaseFinancialState(state, purchase);
    return `
      <article class="purchase-row">
        <div class="purchase-row__identity"><div><strong>${escapeHtml(purchase.reference || purchase.id)}</strong><span>${formatDate(purchase.date || purchase.createdAt)} · ${escapeHtml(String(purchase.type || 'contado').toUpperCase())}</span></div><div><strong>${escapeHtml(purchaseProviderName(state, purchase))}</strong><span>${escapeHtml(purchaseProductLabel(state, purchase))}</span></div></div>
        <div class="purchase-row__money"><span>Total</span><strong>${money(financial.total)}</strong></div>
        <div class="purchase-row__money"><span>Pagado</span><strong>${money(financial.paid)}</strong></div>
        <div class="purchase-row__money purchase-row__balance"><span>Saldo</span><strong>${money(financial.balance)}</strong></div>
        <div class="purchase-row__status"><span class="status-pill status-pill--${statusClass(financial.statusKey)}">${financial.status}</span></div>
        <div class="purchase-row__actions"><button class="button button--ghost button--compact" type="button" data-action="view-purchase" data-purchase-id="${purchase.id}">Ver</button>${financial.balance > 0.005 ? `<button class="button button--primary button--compact" type="button" data-action="pay-purchase" data-purchase-id="${purchase.id}">Pagar</button>` : ''}</div>
      </article>`;
  }

  function openPurchaseForm(preselectedProviderId = '') {
    const state = store.getState();
    const providers = state.proveedores.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
    const products = state.productos.filter((product) => product.active && productVariants(state, product.id).length).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
    if (!providers.length) {
      showToast('Primero agrega un proveedor.', 'error');
      return;
    }
    if (!products.length) {
      showToast('Primero agrega un producto activo con al menos una variante.', 'error');
      return;
    }
    const selectedProvider = providers.some((item) => item.id === preselectedProviderId) ? preselectedProviderId : providers[0].id;
    const selectedProduct = products[0].id;
    const today = localDateKey();

    openModal(`
      <form id="purchaseForm" novalidate>
        <div class="modal-header"><div><p class="modal-eyebrow">COMPRAS</p><h2 id="modalTitle">Nueva compra</h2><p>El costo unitario se guarda como snapshot histórico. Guardar esta compra aumenta solo la variante seleccionada y no modifica el precio de venta.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
        <div class="modal-body">
          <div class="fields-grid fields-grid--3">
            <label class="field-group"><span>Fecha *</span><input id="purchaseDate" type="date" value="${today}" required></label>
            <label class="field-group"><span>Proveedor *</span><select id="purchaseProvider" required>${providers.map((provider) => `<option value="${provider.id}" ${provider.id === selectedProvider ? 'selected' : ''}>${escapeHtml(provider.name)}</option>`).join('')}</select></label>
            <label class="field-group"><span>Tipo *</span><select id="purchaseType" required><option value="contado">Contado</option><option value="credito">Crédito</option></select></label>
            <label class="field-group"><span>Producto *</span><select id="purchaseProduct" required>${products.map((product) => `<option value="${product.id}" ${product.id === selectedProduct ? 'selected' : ''}>${escapeHtml(product.name)} · ${escapeHtml(product.internalCode || '')}</option>`).join('')}</select></label>
            <label class="field-group"><span>Variante *</span><select id="purchaseVariant" required></select></label>
            <label class="field-group"><span>Cantidad *</span><input id="purchaseQuantity" type="number" min="1" step="1" inputmode="numeric" required></label>
            <label class="field-group"><span>Costo unitario de esta compra *</span><div class="money-input"><span>C$</span><input id="purchaseUnitCost" type="number" min="0" step="0.01" inputmode="decimal" required></div></label>
            <div class="purchase-total-preview"><span>Total compra</span><strong id="purchaseTotalPreview">${money(0)}</strong></div>
            <label class="field-group" id="purchaseDueField" hidden><span>Fecha de vencimiento</span><input id="purchaseDueDate" type="date" min="${today}"></label>
            <label class="field-group" id="purchaseInitialField" hidden><span>Pago inicial</span><div class="money-input"><span>C$</span><input id="purchaseInitialPayment" type="number" min="0" step="0.01" inputmode="decimal"></div></label>
            <label class="field-group" id="purchaseMethodField"><span>Método del pago *</span><select id="purchasePaymentMethod">${PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('')}</select></label>
            <label class="field-group field-group--wide"><span>Observación</span><textarea id="purchaseObservation" rows="3" maxlength="500"></textarea></label>
          </div>
          <p class="form-hint">El precio de compra actual del catálogo se usa solo como sugerencia inicial y sigue siendo editable manualmente desde Inventario.</p>
        </div>
        <div class="modal-footer"><button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit">Guardar compra</button></div>
      </form>`, 'modal--large');

    const productSelect = document.getElementById('purchaseProduct');
    const variantSelect = document.getElementById('purchaseVariant');
    const qtyInput = document.getElementById('purchaseQuantity');
    const unitCostInput = document.getElementById('purchaseUnitCost');
    const typeSelect = document.getElementById('purchaseType');
    const purchaseDateInput = document.getElementById('purchaseDate');
    const dueField = document.getElementById('purchaseDueField');
    const dueDateInput = document.getElementById('purchaseDueDate');
    const initialField = document.getElementById('purchaseInitialField');
    const initialInput = document.getElementById('purchaseInitialPayment');
    const methodField = document.getElementById('purchaseMethodField');
    const methodSelect = document.getElementById('purchasePaymentMethod');
    const totalPreview = document.getElementById('purchaseTotalPreview');

    const currentTotal = () => Math.max(0, Number.parseInt(qtyInput.value, 10) || 0) * Math.max(0, Number(unitCostInput.value) || 0);
    const updateTotal = () => {
      totalPreview.textContent = money(currentTotal());
      initialInput.max = currentTotal().toFixed(2);
      updatePaymentMethodVisibility();
    };
    const updatePaymentMethodVisibility = () => {
      const requiresPaymentMethod = typeSelect.value === 'contado' || (Number(initialInput.value) || 0) > 0;
      methodField.hidden = !requiresPaymentMethod;
      methodSelect.required = requiresPaymentMethod;
    };
    const updateVariants = () => {
      const current = store.getState();
      const variants = productVariants(current, productSelect.value);
      variantSelect.innerHTML = variants.map((variant) => `<option value="${variant.id}">${escapeHtml(variantLabel(variant))} · ${quantity(variant.stock)} actuales</option>`).join('');
      const product = current.productos.find((item) => item.id === productSelect.value);
      const variant = variants.find((item) => item.id === variantSelect.value) || variants[0];
      unitCostInput.value = Number(effectiveVariantPurchasePrice(product, variant)).toFixed(2);
      updateTotal();
    };
    const updateSuggestedCost = () => {
      const current = store.getState();
      const product = current.productos.find((item) => item.id === productSelect.value);
      const variant = current.variantes.find((item) => item.id === variantSelect.value);
      if (product && variant) unitCostInput.value = Number(effectiveVariantPurchasePrice(product, variant)).toFixed(2);
      updateTotal();
    };
    const updateCreditFields = () => {
      const wasCredit = !initialField.hidden;
      const credit = typeSelect.value === 'credito';
      dueField.hidden = !credit;
      initialField.hidden = !credit;
      if (!credit) initialInput.value = '';
      else if (!wasCredit || Number(initialInput.value) > currentTotal()) initialInput.value = '';
      dueDateInput.min = purchaseDateInput.value || today;
      if (dueDateInput.value && dueDateInput.value < dueDateInput.min) dueDateInput.value = '';
      updatePaymentMethodVisibility();
    };

    productSelect.addEventListener('change', updateVariants);
    variantSelect.addEventListener('change', updateSuggestedCost);
    qtyInput.addEventListener('input', updateTotal);
    unitCostInput.addEventListener('input', updateTotal);
    typeSelect.addEventListener('change', updateCreditFields);
    purchaseDateInput.addEventListener('change', updateCreditFields);
    initialInput.addEventListener('input', updatePaymentMethodVisibility);
    updateVariants();
    updateCreditFields();

    document.getElementById('purchaseForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const result = commitPurchase({
        date: document.getElementById('purchaseDate').value,
        providerId: document.getElementById('purchaseProvider').value,
        productId: productSelect.value,
        variantId: variantSelect.value,
        quantity: qtyInput.value,
        unitCost: unitCostInput.value,
        type: typeSelect.value,
        dueDate: document.getElementById('purchaseDueDate').value,
        initialPayment: typeSelect.value === 'contado' ? currentTotal() : initialInput.value,
        paymentMethod: methodSelect.value,
        observation: document.getElementById('purchaseObservation').value
      });
      if (!result.ok) {
        showToast(result.error, 'error');
        return;
      }
      closeModal();
      renderRoute();
      showToast(`Compra ${result.reference} registrada.`);
    });
  }

  function commitPurchase(options) {
    const current = store.getState();
    const provider = current.proveedores.find((item) => item.id === options.providerId);
    if (!provider) return { ok: false, error: 'Selecciona un proveedor válido.' };
    const product = current.productos.find((item) => item.id === options.productId);
    const variant = current.variantes.find((item) => item.id === options.variantId && item.productId === options.productId);
    if (!product || !variant) return { ok: false, error: 'Selecciona un producto y variante válidos.' };
    const qty = Number.parseInt(options.quantity, 10);
    const unitCost = Number(options.unitCost);
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: 'La cantidad debe ser mayor que cero.' };
    if (!Number.isFinite(unitCost) || unitCost < 0) return { ok: false, error: 'El costo unitario debe ser válido.' };
    const total = Math.round(qty * unitCost * 100) / 100;
    const type = String(options.type || '').toLowerCase();
    if (!['contado', 'credito'].includes(type)) return { ok: false, error: 'Tipo de compra inválido.' };
    const dateKey = String(options.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { ok: false, error: 'Selecciona una fecha válida.' };
    const dueDate = type === 'credito' && options.dueDate ? String(options.dueDate).slice(0, 10) : null;
    if (dueDate && dueDate < dateKey) return { ok: false, error: 'La fecha de vencimiento no puede ser anterior a la compra.' };
    let initialPayment = type === 'contado' ? total : Number(options.initialPayment || 0);
    if (!Number.isFinite(initialPayment) || initialPayment < 0) return { ok: false, error: 'El pago inicial debe ser un monto válido.' };
    if (initialPayment > total + 0.005) return { ok: false, error: 'El pago inicial no puede superar el total de la compra.' };
    initialPayment = Math.min(total, initialPayment);
    const method = String(options.paymentMethod || '');
    if (initialPayment > 0.005 && !PAYMENT_METHODS.includes(method)) return { ok: false, error: 'Selecciona un método de pago válido.' };

    const number = purchaseNumber(current);
    const reference = purchaseReference(number);
    const purchaseId = uid('com');
    const now = new Date().toISOString();
    const purchaseDate = `${dateKey}T12:00:00`;
    const balance = Math.max(0, total - initialPayment);
    const movementId = uid('mov');

    const success = store.transact((draft) => {
      const targetVariant = draft.variantes.find((item) => item.id === variant.id && item.productId === product.id);
      if (!targetVariant) return;
      const before = Number(targetVariant.stock) || 0;
      targetVariant.stock = before + qty;
      targetVariant.updatedAt = now;

      draft.compras.push({
        id: purchaseId,
        purchaseNumber: number,
        reference,
        date: purchaseDate,
        providerId: provider.id,
        providerSnapshot: { id: provider.id, name: provider.name, phone: provider.phone },
        productId: product.id,
        variantId: variant.id,
        productNameSnapshot: product.name,
        productCodeSnapshot: product.internalCode || '',
        variantLabelSnapshot: variantLabel(variant),
        quantity: qty,
        unitCost,
        total,
        type,
        dueDate,
        initialPayment,
        totalPaid: initialPayment,
        balance,
        paymentStatus: balance <= 0.005 ? 'pagado' : (initialPayment > 0.005 ? 'abonado' : 'pendiente'),
        observation: String(options.observation || '').trim(),
        inventoryMovementId: movementId,
        status: 'confirmada',
        createdAt: now,
        updatedAt: now
      });

      draft.movimientosInventario.push({
        id: movementId,
        date: purchaseDate,
        productId: product.id,
        variantId: variant.id,
        quantity: qty,
        type: 'entrada',
        reason: 'Compra',
        note: reference,
        relatedPurchaseId: purchaseId,
        unitCostSnapshot: unitCost,
        productNameSnapshot: product.name,
        variantLabelSnapshot: variantLabel(variant),
        stockBefore: before,
        stockAfter: targetVariant.stock,
        createdAt: now
      });

      if (initialPayment > 0.005) {
        draft.pagosProveedores.push({
          id: uid('pagpro'),
          date: purchaseDate,
          providerId: provider.id,
          purchaseId,
          reference,
          amount: initialPayment,
          method,
          kind: type === 'contado' ? 'Pago de contado' : 'Pago inicial',
          observation: '',
          status: 'confirmado',
          source: 'compra',
          createdAt: now
        });
      }
    });

    if (!success) return { ok: false, error: 'No se pudo guardar la compra.' };
    return { ok: true, purchaseId, reference, total, initialPayment, balance };
  }

  function openPurchaseDetail(purchaseId) {
    const state = store.getState();
    const purchase = state.compras.find((item) => item.id === purchaseId);
    if (!purchase) {
      showToast('No se encontró la compra.', 'error');
      return;
    }
    const financial = purchaseFinancialState(state, purchase);
    const paymentRows = financial.payments.length ? financial.payments.map((payment) => `
      <div class="payment-history-row"><div><strong>${formatDate(payment.date || payment.createdAt)}</strong><span>${escapeHtml(payment.kind || 'Pago')} · ${escapeHtml(payment.method || '—')}${payment.observation ? ` · ${escapeHtml(payment.observation)}` : ''}</span></div><strong>${money(numericValue(payment, ['amount', 'monto', 'total', 'importe']))}</strong></div>`).join('') : '<div class="client-history-empty">Esta compra todavía no tiene pagos.</div>';

    openModal(`
      <div class="modal-header"><div><p class="modal-eyebrow">CUENTA POR PAGAR</p><h2 id="modalTitle">${escapeHtml(purchase.reference || purchase.id)}</h2><p>${escapeHtml(purchaseProviderName(state, purchase))} · ${formatDate(purchase.date || purchase.createdAt)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
      <div class="modal-body">
        <section class="purchase-detail-summary"><div><span>Total compra</span><strong>${money(financial.total)}</strong></div><div><span>Pagado</span><strong>${money(financial.paid)}</strong></div><div class="purchase-detail-summary__accent"><span>Saldo</span><strong>${money(financial.balance)}</strong></div><div><span>Estado</span><strong>${financial.status}</strong></div><div><span>Vence</span><strong>${financial.dueDate ? formatDate(financial.dueDate) : '—'}</strong></div></section>
        <section class="purchase-detail-product"><div><span>Producto / variante</span><strong>${escapeHtml(purchaseProductLabel(state, purchase))}</strong></div><div><span>Cantidad</span><strong>${quantity(purchase.quantity)}</strong></div><div><span>Costo unitario snapshot</span><strong>${money(purchase.unitCost)}</strong></div></section>
        ${purchase.observation ? `<div class="purchase-observation"><span>Observación</span><p>${escapeHtml(purchase.observation)}</p></div>` : ''}
        <section class="payment-history-block"><div class="payment-history-heading"><h3>Historial de pagos</h3><span>${quantity(financial.payments.length)}</span></div><div class="payment-history-list">${paymentRows}</div></section>
        <p class="sale-history-note">La compra conserva su costo unitario histórico. Los pagos posteriores no cambian la fecha ni la entrada de inventario original.</p>
      </div>
      <div class="modal-footer">${financial.balance > 0.005 ? `<button class="button button--primary" type="button" data-action="pay-purchase" data-purchase-id="${purchase.id}">Registrar pago</button>` : ''}<button class="button button--secondary" type="button" data-action="close-modal">Cerrar</button></div>`, 'modal--large');
  }

  function commitSupplierPayment(options) {
    const current = store.getState();
    const purchase = current.compras.find((item) => item.id === options.purchaseId && !isPurchaseCancelled(item));
    if (!purchase) return { ok: false, error: 'La compra seleccionada no está disponible para pago.' };
    const provider = current.proveedores.find((item) => item.id === purchase.providerId);
    const financial = purchaseFinancialState(current, purchase);
    if (financial.balance <= 0.005) return { ok: false, error: 'Esta compra ya está pagada.' };
    const amount = Number(options.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Ingresa un monto válido mayor que cero.' };
    if (amount > financial.balance + 0.005) return { ok: false, error: 'El pago no puede superar el saldo pendiente.' };
    const method = String(options.method || '');
    if (!PAYMENT_METHODS.includes(method)) return { ok: false, error: 'Selecciona un método de pago válido.' };
    const dateKey = String(options.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { ok: false, error: 'Selecciona una fecha de pago válida.' };
    if (dateKey > localDateKey()) return { ok: false, error: 'La fecha de pago no puede estar en el futuro.' };
    const normalizedAmount = Math.min(financial.balance, Math.round(amount * 100) / 100);
    const afterBalance = Math.max(0, financial.balance - normalizedAmount);
    const kind = afterBalance <= 0.005 ? 'Pago completo' : 'Abono';
    const now = new Date().toISOString();
    const paymentDate = `${dateKey}T12:00:00`;

    const success = store.transact((draft) => {
      draft.pagosProveedores.push({
        id: uid('pagpro'),
        date: paymentDate,
        providerId: purchase.providerId,
        purchaseId: purchase.id,
        reference: purchase.reference || purchase.id,
        amount: normalizedAmount,
        method,
        kind,
        observation: String(options.observation || '').trim(),
        status: 'confirmado',
        source: 'pagos-proveedores',
        createdAt: now
      });
      const target = draft.compras.find((item) => item.id === purchase.id);
      if (target) {
        const newPaid = Math.min(Number(target.total) || financial.total, financial.paid + normalizedAmount);
        target.totalPaid = newPaid;
        target.balance = Math.max(0, (Number(target.total) || financial.total) - newPaid);
        target.paymentStatus = target.balance <= 0.005 ? 'pagado' : 'abonado';
        target.updatedAt = now;
      }
    });
    if (!success) return { ok: false, error: 'No se pudo guardar el pago.' };
    return { ok: true, amount: normalizedAmount, balance: afterBalance, kind, providerName: provider?.name || purchase.providerSnapshot?.name || '' };
  }

  function openSupplierPaymentForm(purchaseId) {
    const state = store.getState();
    const purchase = state.compras.find((item) => item.id === purchaseId && !isPurchaseCancelled(item));
    if (!purchase) {
      showToast('No se encontró la compra seleccionada.', 'error');
      return;
    }
    const financial = purchaseFinancialState(state, purchase);
    if (financial.balance <= 0.005) {
      showToast('Esta compra ya está pagada.', 'error');
      return;
    }
    const today = localDateKey();
    openModal(`
      <form id="supplierPaymentForm" novalidate>
        <div class="modal-header"><div><p class="modal-eyebrow">PAGOS A PROVEEDORES</p><h2 id="modalTitle">Registrar pago</h2><p>${escapeHtml(purchase.reference || purchase.id)} · ${escapeHtml(purchaseProviderName(state, purchase))}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
        <div class="modal-body">
          <section class="payment-balance-strip"><div><span>Total compra</span><strong>${money(financial.total)}</strong></div><div><span>Pagado</span><strong>${money(financial.paid)}</strong></div><div class="payment-balance-strip__accent"><span>Saldo</span><strong>${money(financial.balance)}</strong></div></section>
          <div class="fields-grid fields-grid--2">
            <label class="field-group"><span>Fecha *</span><input id="supplierPaymentDate" type="date" value="${today}" max="${today}" required></label>
            <label class="field-group"><span>Tipo *</span><select id="supplierPaymentKind"><option value="abono">Abono</option><option value="completo">Pago completo</option></select></label>
            <label class="field-group"><span>Monto *</span><div class="money-input"><span>C$</span><input id="supplierPaymentAmount" type="number" min="0.01" max="${financial.balance.toFixed(2)}" step="0.01" inputmode="decimal" required></div></label>
            <label class="field-group"><span>Método *</span><select id="supplierPaymentMethod" required>${PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('')}</select></label>
            <label class="field-group field-group--wide"><span>Observación</span><textarea id="supplierPaymentObservation" rows="3" maxlength="400"></textarea></label>
          </div>
          <p class="form-hint">El sobrepago está bloqueado. Este pago no modifica inventario ni costos históricos.</p>
        </div>
        <div class="modal-footer"><button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit">Guardar pago</button></div>
      </form>`, 'modal--medium');

    const kindSelect = document.getElementById('supplierPaymentKind');
    const amountInput = document.getElementById('supplierPaymentAmount');
    kindSelect.addEventListener('change', () => {
      if (kindSelect.value === 'completo') {
        amountInput.value = financial.balance.toFixed(2);
        amountInput.readOnly = true;
      } else {
        amountInput.readOnly = false;
        amountInput.value = '';
      }
    });

    document.getElementById('supplierPaymentForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const result = commitSupplierPayment({
        purchaseId,
        date: document.getElementById('supplierPaymentDate').value,
        amount: kindSelect.value === 'completo' ? financial.balance : amountInput.value,
        method: document.getElementById('supplierPaymentMethod').value,
        observation: document.getElementById('supplierPaymentObservation').value
      });
      if (!result.ok) {
        showToast(result.error, 'error');
        return;
      }
      closeModal();
      renderRoute();
      showToast(result.balance <= 0.005 ? 'Compra pagada completamente.' : 'Abono registrado.');
    });
  }

  // ===== Etapa 7/10 · Apartados + Cambios + Devoluciones =====
  function apartadoNumber(state) {
    return state.apartados.reduce((max, item) => Math.max(max, Number(item.apartadoNumber) || 0), 0) + 1;
  }

  function apartadoReference(number) {
    return `AP-${String(number).padStart(6, '0')}`;
  }

  function isApartadoCancelled(apartado) {
    return ['cancelado', 'cancelada', 'anulado', 'anulada'].includes(String(apartado?.status || '').toLowerCase());
  }

  function isApartadoCompleted(apartado) {
    return String(apartado?.status || '').toLowerCase() === 'completado';
  }

  function apartadoPaymentHistory(apartado) {
    return (Array.isArray(apartado?.payments) ? apartado.payments : [])
      .filter((payment) => !isPaymentCancelled(payment))
      .slice()
      .sort((a, b) => new Date(a.date || a.createdAt || 0).getTime() - new Date(b.date || b.createdAt || 0).getTime());
  }

  function apartadoFinancialState(apartado) {
    const quantityValue = Math.max(0, Number.parseInt(apartado?.quantity, 10) || 0);
    const unitPrice = Math.max(0, Number(apartado?.unitPrice ?? apartado?.price) || 0);
    const total = Math.max(0, Number(apartado?.total) || (quantityValue * unitPrice));
    const payments = apartadoPaymentHistory(apartado);
    const paidFromPayments = payments.reduce((sum, payment) => sum + Math.max(0, numericValue(payment, ['amount', 'monto'])), 0);
    const legacyInitial = Math.max(0, numericValue(apartado, ['initialPayment', 'pagoInicial']));
    const paid = Math.min(total, payments.length ? paidFromPayments : legacyInitial);
    const balance = Math.max(0, total - paid);
    const rawStatus = String(apartado?.status || '').toLowerCase();
    let status = 'Activo';
    let statusKey = 'activo';
    if (isApartadoCancelled(apartado)) {
      status = 'Cancelado';
      statusKey = 'cancelado';
    } else if (isApartadoCompleted(apartado)) {
      status = 'Completado';
      statusKey = 'completado';
    } else if (balance <= 0.005) {
      status = 'Listo para completar';
      statusKey = 'listo';
    } else if (paid > 0.005 || rawStatus === 'abonado') {
      status = 'Abonado';
      statusKey = 'abonado';
    }
    return { total, paid, balance, payments, status, statusKey };
  }

  function apartadoStatusClass(statusKey) {
    if (statusKey === 'completado') return 'paid';
    if (statusKey === 'cancelado') return 'inactive';
    if (statusKey === 'abonado' || statusKey === 'listo') return 'partial';
    return 'pending';
  }

  function apartadoClientName(state, apartado) {
    return apartado.clientSnapshot?.name || state.clientes.find((item) => item.id === apartado.clientId)?.name || 'Cliente';
  }

  function apartadoProductName(state, apartado) {
    return apartado.productSnapshot?.name || state.productos.find((item) => item.id === apartado.productId)?.name || 'Producto';
  }

  function completeApartadoInDraft(draft, apartadoId, paymentMethod, completedAt) {
    const apartado = draft.apartados.find((item) => item.id === apartadoId);
    if (!apartado || isApartadoCancelled(apartado) || isApartadoCompleted(apartado)) return { ok: false, error: 'El apartado no puede completarse.' };
    const financial = apartadoFinancialState(apartado);
    if (financial.balance > 0.005) return { ok: false, error: 'El apartado todavía tiene saldo pendiente.' };

    const variant = draft.variantes.find((item) => item.id === apartado.variantId && item.productId === apartado.productId);
    const product = draft.productos.find((item) => item.id === apartado.productId);
    if (!variant || !product) return { ok: false, error: 'El producto o variante del apartado ya no existe.' };
    const qty = Math.max(1, Number.parseInt(apartado.quantity, 10) || 1);
    const availableExcludingOwnReservation = availableStockForVariant(draft, variant.id, apartado.id);
    if (qty > availableExcludingOwnReservation) return { ok: false, error: 'No hay existencia física suficiente para completar el apartado sin afectar otras reservas.' };

    const number = saleNumber(draft);
    const reference = saleReference(number);
    const saleId = uid('ven');
    const unitPrice = Math.max(0, Number(apartado.unitPrice) || 0);
    const purchasePrice = Math.max(0, Number(apartado.purchasePriceSnapshot) || effectiveVariantPurchasePrice(product, variant));
    const total = Math.max(0, Number(apartado.total) || (unitPrice * qty));
    const totalUtility = (unitPrice - purchasePrice) * qty;
    const client = draft.clientes.find((item) => item.id === apartado.clientId);

    draft.ventas.push({
      id: saleId,
      saleNumber: number,
      reference,
      date: completedAt,
      type: 'contado',
      clientId: apartado.clientId,
      clientSnapshot: apartado.clientSnapshot || (client ? { id: client.id, name: client.name, phone: client.phone } : null),
      paymentMethod: PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : (apartado.lastPaymentMethod || 'Efectivo'),
      dueDate: null,
      subtotalBruto: total,
      discountTotal: 0,
      total,
      initialPayment: total,
      totalPaid: total,
      balance: 0,
      paymentStatus: 'pagado',
      totalUtility,
      status: 'confirmada',
      source: 'apartado',
      relatedApartadoId: apartado.id,
      lines: [{
        id: uid('lin'),
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        productCode: product.internalCode || '',
        variantLabel: apartado.variantSnapshot?.label || variantLabel(variant),
        quantity: qty,
        salePrice: unitPrice,
        purchasePrice,
        unitDiscount: 0,
        discountTotal: 0,
        grossTotal: total,
        lineTotal: total,
        unitUtility: unitPrice - purchasePrice,
        lineUtility: totalUtility
      }],
      createdAt: completedAt,
      updatedAt: completedAt
    });

    const before = Number(variant.stock) || 0;
    variant.stock = before - qty;
    variant.updatedAt = completedAt;
    draft.movimientosInventario.push({
      id: uid('mov'),
      date: completedAt,
      productId: product.id,
      variantId: variant.id,
      quantity: qty,
      type: 'salida',
      reason: 'Venta desde apartado',
      note: `${apartado.reference || apartado.id} → ${reference}`,
      relatedSaleId: saleId,
      relatedApartadoId: apartado.id,
      productNameSnapshot: product.name,
      variantLabelSnapshot: apartado.variantSnapshot?.label || variantLabel(variant),
      stockBefore: before,
      stockAfter: variant.stock,
      createdAt: completedAt
    });

    apartado.status = 'completado';
    apartado.completedAt = completedAt;
    apartado.saleId = saleId;
    apartado.saleReference = reference;
    apartado.balance = 0;
    apartado.totalPaid = total;
    apartado.updatedAt = completedAt;
    return { ok: true, saleId, reference };
  }

  function commitApartado(options) {
    const current = store.getState();
    const client = current.clientes.find((item) => item.id === options.clientId);
    if (!client) return { ok: false, error: 'Selecciona un cliente válido.' };
    const product = current.productos.find((item) => item.id === options.productId && item.active);
    const variant = current.variantes.find((item) => item.id === options.variantId && item.productId === options.productId);
    if (!product || !variant) return { ok: false, error: 'Selecciona un producto y variante disponibles.' };
    const qty = Number.parseInt(options.quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: 'La cantidad debe ser un entero mayor que cero.' };
    if (qty > availableStockForVariant(current, variant.id)) return { ok: false, error: 'La cantidad supera la existencia disponible; puede haber unidades ya reservadas.' };
    const unitPrice = Number(options.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return { ok: false, error: 'Ingresa un precio válido mayor que cero.' };
    const total = Math.round((qty * unitPrice + Number.EPSILON) * 100) / 100;
    const initialPayment = options.initialPayment === '' ? 0 : Number(options.initialPayment);
    if (!Number.isFinite(initialPayment) || initialPayment < 0) return { ok: false, error: 'El pago inicial debe ser un monto válido.' };
    if (initialPayment > total + 0.005) return { ok: false, error: 'El pago inicial no puede superar el total del apartado.' };
    const method = String(options.method || '');
    if (initialPayment > 0 && !PAYMENT_METHODS.includes(method)) return { ok: false, error: 'Selecciona un método válido para el pago inicial.' };
    const dateKey = String(options.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { ok: false, error: 'Selecciona una fecha válida.' };
    if (dateKey > localDateKey()) return { ok: false, error: 'La fecha no puede estar en el futuro.' };

    const number = apartadoNumber(current);
    const reference = apartadoReference(number);
    const apartadoId = uid('apa');
    const now = new Date().toISOString();
    const transactionDate = `${dateKey}T12:00:00`;
    let completion = null;
    let saveError = '';
    const saved = store.transact((draft) => {
      if (qty > availableStockForVariant(draft, variant.id)) {
        saveError = 'La existencia disponible cambió y ya no alcanza para reservar esta cantidad.';
        return;
      }
      const payments = [];
      if (initialPayment > 0) {
        payments.push({
          id: uid('apaab'),
          date: transactionDate,
          amount: Math.round(initialPayment * 100) / 100,
          method,
          kind: 'Pago inicial',
          status: 'confirmado',
          createdAt: now
        });
      }
      draft.apartados.push({
        id: apartadoId,
        apartadoNumber: number,
        reference,
        date: transactionDate,
        clientId: client.id,
        clientSnapshot: { id: client.id, name: client.name, phone: client.phone },
        productId: product.id,
        productSnapshot: { id: product.id, name: product.name, code: product.internalCode || '' },
        variantId: variant.id,
        variantSnapshot: { id: variant.id, label: variantLabel(variant) },
        quantity: qty,
        unitPrice,
        purchasePriceSnapshot: effectiveVariantPurchasePrice(product, variant),
        total,
        initialPayment: Math.round(initialPayment * 100) / 100,
        totalPaid: Math.round(initialPayment * 100) / 100,
        balance: Math.max(0, total - initialPayment),
        payments,
        status: initialPayment > 0 ? 'abonado' : 'activo',
        observation: String(options.observation || '').trim(),
        lastPaymentMethod: initialPayment > 0 ? method : null,
        createdAt: now,
        updatedAt: now
      });
      if (total - initialPayment <= 0.005) {
        completion = completeApartadoInDraft(draft, apartadoId, method, now);
        if (!completion.ok) saveError = completion.error;
      }
    });
    if (!saved || saveError) return { ok: false, error: saveError || 'No se pudo guardar el apartado.' };
    return { ok: true, apartadoId, reference, completed: Boolean(completion?.ok), saleReference: completion?.reference || null };
  }

  function commitApartadoPayment(options) {
    const current = store.getState();
    const apartado = current.apartados.find((item) => item.id === options.apartadoId);
    if (!apartado || !isApartadoActive(apartado)) return { ok: false, error: 'El apartado no está disponible para recibir abonos.' };
    const financial = apartadoFinancialState(apartado);
    if (financial.balance <= 0.005) return { ok: false, error: 'El apartado ya no tiene saldo pendiente.' };
    const amount = Number(options.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Ingresa un monto de abono mayor que cero.' };
    if (amount > financial.balance + 0.005) return { ok: false, error: `El abono no puede superar el saldo de ${money(financial.balance)}.` };
    const method = String(options.method || '');
    if (!PAYMENT_METHODS.includes(method)) return { ok: false, error: 'Selecciona un método de pago válido.' };
    const dateKey = String(options.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { ok: false, error: 'Selecciona una fecha válida.' };
    if (dateKey > localDateKey()) return { ok: false, error: 'La fecha no puede estar en el futuro.' };
    const normalizedAmount = Math.min(financial.balance, Math.round((amount + Number.EPSILON) * 100) / 100);
    const afterBalance = Math.max(0, financial.balance - normalizedAmount);
    if (afterBalance <= 0.005 && Number.parseInt(apartado.quantity, 10) > availableStockForVariant(current, apartado.variantId, apartado.id)) {
      return { ok: false, error: 'No se puede completar: la existencia física ya no alcanza sin afectar otras reservas.' };
    }

    const now = new Date().toISOString();
    const paymentDate = `${dateKey}T12:00:00`;
    let completion = null;
    let saveError = '';
    const saved = store.transact((draft) => {
      const target = draft.apartados.find((item) => item.id === apartado.id);
      if (!target || !isApartadoActive(target)) {
        saveError = 'El apartado cambió de estado antes de guardar el abono.';
        return;
      }
      if (!Array.isArray(target.payments)) target.payments = [];
      target.payments.push({
        id: uid('apaab'),
        date: paymentDate,
        amount: normalizedAmount,
        method,
        kind: afterBalance <= 0.005 ? 'Pago final' : 'Abono',
        observation: String(options.observation || '').trim(),
        status: 'confirmado',
        createdAt: now
      });
      const refreshed = apartadoFinancialState(target);
      target.totalPaid = refreshed.paid;
      target.balance = refreshed.balance;
      target.lastPaymentMethod = method;
      target.status = refreshed.balance <= 0.005 ? 'abonado' : 'abonado';
      target.updatedAt = now;
      if (refreshed.balance <= 0.005) {
        completion = completeApartadoInDraft(draft, target.id, method, now);
        if (!completion.ok) saveError = completion.error;
      }
    });
    if (!saved || saveError) return { ok: false, error: saveError || 'No se pudo guardar el abono.' };
    return { ok: true, balance: afterBalance, completed: Boolean(completion?.ok), saleReference: completion?.reference || null };
  }

  function cancelApartado(apartadoId) {
    const current = store.getState();
    const apartado = current.apartados.find((item) => item.id === apartadoId);
    if (!apartado || !isApartadoActive(apartado)) return { ok: false, error: 'Solo se pueden cancelar apartados activos o abonados.' };
    const financial = apartadoFinancialState(apartado);
    const now = new Date().toISOString();
    const saved = store.transact((draft) => {
      const target = draft.apartados.find((item) => item.id === apartadoId);
      if (!target) return;
      target.status = 'cancelado';
      target.cancelledAt = now;
      target.cancellationMoneyStatus = financial.paid > 0.005 ? 'sin_resolver' : 'sin_pago';
      target.updatedAt = now;
    });
    if (!saved) return { ok: false, error: 'No se pudo cancelar el apartado.' };
    return { ok: true, paid: financial.paid };
  }

  function renderApartados(module) {
    const state = store.getState();
    const items = state.apartados.slice().sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
    const active = items.filter((item) => isApartadoActive(item));
    const reservedUnits = active.reduce((sum, item) => sum + (Number.parseInt(item.quantity, 10) || 0), 0);
    const pendingBalance = active.reduce((sum, item) => sum + apartadoFinancialState(item).balance, 0);
    const completed = items.filter((item) => isApartadoCompleted(item)).length;
    const operations = state.operacionesPostVenta.slice().sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());

    return `
      <section class="page-panel reservations-page" aria-labelledby="pageTitle">
        <div class="page-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div><h1 id="pageTitle">Apartados</h1><p>Reservas de mercadería, abonos y operaciones postventa sin duplicar inventario ni alterar ventas antiguas.</p></div>
          </div>
          <span class="stage-chip">V1</span>
        </div>

        <section class="reservations-summary" aria-label="Resumen de apartados">
          <article class="metric-card metric-card--accent"><span>Apartados activos</span><strong>${quantity(active.length)}</strong></article>
          <article class="metric-card"><span>Unidades reservadas</span><strong>${quantity(reservedUnits)}</strong></article>
          <article class="metric-card"><span>Saldo pendiente</span><strong>${money(pendingBalance)}</strong></article>
          <article class="metric-card"><span>Completados</span><strong>${quantity(completed)}</strong></article>
        </section>

        <section class="reservation-section">
          <div class="reservation-section__heading">
            <div><h2>Apartados y reservas</h2><p>La reserva reduce lo disponible, pero la existencia física solo se descuenta al completar.</p></div>
            <button class="button button--primary" type="button" data-action="new-apartado">＋ Nuevo apartado</button>
          </div>
          <div class="reservation-list">
            ${items.length ? items.map((item) => renderApartadoRow(state, item)).join('') : `<div class="sales-empty"><span class="sales-empty__mark">▣</span><h3>Aún no hay apartados</h3><p>Registra una reserva para bloquear mercadería sin descontar todavía la existencia física.</p><button class="button button--primary" type="button" data-action="new-apartado">＋ Nuevo apartado</button></div>`}
          </div>
        </section>

        <section class="reservation-section reservation-section--post-sale">
          <div class="reservation-section__heading">
            <div><h2>Cambios y devoluciones</h2><p>Las operaciones quedan ligadas a la venta original y conservan historial.</p></div>
            <div class="reservation-actions"><button class="button button--secondary" type="button" data-action="new-change">⇄ Registrar cambio</button><button class="button button--secondary" type="button" data-action="new-return">↩ Registrar devolución</button></div>
          </div>
          <div class="post-sale-list">
            ${operations.length ? operations.map((operation) => renderPostSaleRow(state, operation)).join('') : `<div class="client-history-empty">Todavía no hay cambios ni devoluciones registrados.</div>`}
          </div>
        </section>
      </section>
      <div id="modalRoot"></div>`;
  }

  function renderApartadoRow(state, apartado) {
    const financial = apartadoFinancialState(apartado);
    const canAct = isApartadoActive(apartado);
    return `
      <article class="reservation-row">
        <div class="reservation-row__main"><strong>${escapeHtml(apartado.reference || apartado.id)}</strong><span>${formatDate(apartado.date || apartado.createdAt)} · ${escapeHtml(apartadoClientName(state, apartado))}</span><small>${escapeHtml(apartadoProductName(state, apartado))} · ${escapeHtml(apartado.variantSnapshot?.label || 'Variante')} · ${quantity(apartado.quantity)} pieza${Number(apartado.quantity) === 1 ? '' : 's'}</small></div>
        <div class="reservation-row__metric"><span>Total</span><strong>${money(financial.total)}</strong></div>
        <div class="reservation-row__metric"><span>Saldo</span><strong>${money(financial.balance)}</strong></div>
        <div><span class="status-pill status-pill--${apartadoStatusClass(financial.statusKey)}">${financial.status}</span></div>
        <div class="reservation-row__actions">
          <button class="button button--secondary button--compact" type="button" data-action="view-apartado" data-apartado-id="${apartado.id}">Ver</button>
          ${canAct && financial.balance > 0.005 ? `<button class="button button--primary button--compact" type="button" data-action="pay-apartado" data-apartado-id="${apartado.id}">Abonar</button>` : ''}
          ${canAct ? `<button class="button button--ghost button--compact" type="button" data-action="cancel-apartado" data-apartado-id="${apartado.id}">Cancelar</button>` : ''}
        </div>
      </article>`;
  }

  function openApartadoForm() {
    const state = store.getState();
    const clients = state.clientes.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
    const products = state.productos.filter((product) => product.active && productVariants(state, product.id).length).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
    if (!clients.length) { showToast('Primero registra al menos un cliente.', 'error'); return; }
    if (!products.length) { showToast('Primero registra productos activos con variantes.', 'error'); return; }
    const today = localDateKey();
    openModal(`
      <form id="apartadoForm" novalidate>
        <div class="modal-header"><div><p class="modal-eyebrow">APARTADOS</p><h2 id="modalTitle">Nuevo apartado</h2><p>Reserva mercadería sin descontar todavía la existencia física.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
        <div class="modal-body">
          <div class="fields-grid fields-grid--2">
            <label class="field-group"><span>Fecha *</span><input id="apartadoDate" type="date" value="${today}" max="${today}" required></label>
            <label class="field-group"><span>Cliente *</span><select id="apartadoClient" required>${clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)} · ${escapeHtml(client.phone || '')}</option>`).join('')}</select></label>
            <label class="field-group"><span>Producto *</span><select id="apartadoProduct" required>${products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)} · ${escapeHtml(product.internalCode || '')}</option>`).join('')}</select></label>
            <label class="field-group"><span>Variante *</span><select id="apartadoVariant" required></select></label>
            <label class="field-group"><span>Cantidad *</span><input id="apartadoQuantity" type="number" min="1" step="1" inputmode="numeric" required></label>
            <label class="field-group"><span>Precio por pieza *</span><div class="money-input"><span>C$</span><input id="apartadoPrice" type="number" min="0.01" step="0.01" inputmode="decimal" required></div></label>
            <label class="field-group"><span>Pago inicial</span><div class="money-input"><span>C$</span><input id="apartadoInitial" type="number" min="0" step="0.01" inputmode="decimal"></div></label>
            <label class="field-group"><span>Método del pago inicial</span><select id="apartadoMethod">${PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('')}</select></label>
            <label class="field-group field-group--wide"><span>Observación</span><textarea id="apartadoObservation" rows="3" maxlength="500"></textarea></label>
          </div>
          <section class="reservation-preview" id="apartadoPreview"></section>
        </div>
        <div class="modal-footer"><button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit">Guardar apartado</button></div>
      </form>`, 'modal--medium');

    const productSelect = document.getElementById('apartadoProduct');
    const variantSelect = document.getElementById('apartadoVariant');
    const qtyInput = document.getElementById('apartadoQuantity');
    const priceInput = document.getElementById('apartadoPrice');
    const initialInput = document.getElementById('apartadoInitial');
    const preview = document.getElementById('apartadoPreview');

    const currentSelection = () => {
      const current = store.getState();
      const product = current.productos.find((item) => item.id === productSelect.value);
      const variant = current.variantes.find((item) => item.id === variantSelect.value && item.productId === productSelect.value);
      return { current, product, variant };
    };
    const refreshPreview = () => {
      const { current, variant } = currentSelection();
      const qty = Math.max(0, Number.parseInt(qtyInput.value, 10) || 0);
      const price = Math.max(0, Number(priceInput.value) || 0);
      const initial = Math.max(0, Number(initialInput.value) || 0);
      const total = qty * price;
      const available = variant ? availableStockForVariant(current, variant.id) : 0;
      preview.innerHTML = `<div><span>Existencia física</span><strong>${variant ? quantity(variant.stock) : '0'}</strong></div><div><span>Reservada actual</span><strong>${variant ? quantity(reservedStockForVariant(current, variant.id)) : '0'}</strong></div><div><span>Disponible</span><strong>${quantity(available)}</strong></div><div><span>Total apartado</span><strong>${money(total)}</strong></div><div><span>Saldo</span><strong>${money(Math.max(0, total - initial))}</strong></div>`;
    };
    const refreshVariants = () => {
      const current = store.getState();
      const product = current.productos.find((item) => item.id === productSelect.value);
      const variants = productVariants(current, productSelect.value);
      variantSelect.innerHTML = variants.map((variant) => `<option value="${variant.id}">${escapeHtml(variantLabel(variant))} · ${quantity(availableStockForVariant(current, variant.id))} disponibles</option>`).join('');
      const selected = variants.find((variant) => variant.id === variantSelect.value) || variants[0];
      if (product && selected) priceInput.value = effectiveVariantSalePrice(product, selected).toFixed(2);
      refreshPreview();
    };
    productSelect.addEventListener('change', refreshVariants);
    variantSelect.addEventListener('change', () => {
      const { product, variant } = currentSelection();
      if (product && variant) priceInput.value = effectiveVariantSalePrice(product, variant).toFixed(2);
      refreshPreview();
    });
    [qtyInput, priceInput, initialInput].forEach((input) => input.addEventListener('input', refreshPreview));
    refreshVariants();

    document.getElementById('apartadoForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const result = commitApartado({
        date: document.getElementById('apartadoDate').value,
        clientId: document.getElementById('apartadoClient').value,
        productId: productSelect.value,
        variantId: variantSelect.value,
        quantity: qtyInput.value,
        unitPrice: priceInput.value,
        initialPayment: initialInput.value,
        method: document.getElementById('apartadoMethod').value,
        observation: document.getElementById('apartadoObservation').value
      });
      if (!result.ok) { showToast(result.error, 'error'); return; }
      closeModal();
      renderRoute();
      showToast(result.completed ? `${result.reference} completado y convertido en ${result.saleReference}.` : `${result.reference} reservado correctamente.`);
    });
  }

  function openApartadoPaymentForm(apartadoId) {
    const state = store.getState();
    const apartado = state.apartados.find((item) => item.id === apartadoId && isApartadoActive(item));
    if (!apartado) { showToast('No se encontró un apartado activo.', 'error'); return; }
    const financial = apartadoFinancialState(apartado);
    if (financial.balance <= 0.005) { showToast('El apartado ya no tiene saldo pendiente.', 'error'); return; }
    const today = localDateKey();
    openModal(`
      <form id="apartadoPaymentForm" novalidate>
        <div class="modal-header"><div><p class="modal-eyebrow">ABONO A APARTADO</p><h2 id="modalTitle">${escapeHtml(apartado.reference || apartado.id)}</h2><p>${escapeHtml(apartadoClientName(state, apartado))} · ${escapeHtml(apartadoProductName(state, apartado))}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
        <div class="modal-body">
          <section class="payment-balance-strip"><div><span>Total</span><strong>${money(financial.total)}</strong></div><div><span>Pagado</span><strong>${money(financial.paid)}</strong></div><div class="payment-balance-strip__accent"><span>Saldo</span><strong>${money(financial.balance)}</strong></div></section>
          <div class="fields-grid fields-grid--2">
            <label class="field-group"><span>Fecha *</span><input id="apartadoPaymentDate" type="date" value="${today}" max="${today}" required></label>
            <label class="field-group"><span>Monto *</span><div class="money-input"><span>C$</span><input id="apartadoPaymentAmount" type="number" min="0.01" max="${financial.balance.toFixed(2)}" step="0.01" inputmode="decimal" required></div></label>
            <label class="field-group"><span>Método *</span><select id="apartadoPaymentMethod" required>${PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('')}</select></label>
            <label class="field-group field-group--wide"><span>Observación</span><textarea id="apartadoPaymentObservation" rows="3" maxlength="400"></textarea></label>
          </div>
          <p class="form-hint">Si el saldo llega a cero, el apartado se convertirá automáticamente en venta y el inventario físico se descontará una sola vez.</p>
        </div>
        <div class="modal-footer"><button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit">Guardar abono</button></div>
      </form>`, 'modal--medium');
    document.getElementById('apartadoPaymentForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const result = commitApartadoPayment({
        apartadoId,
        date: document.getElementById('apartadoPaymentDate').value,
        amount: document.getElementById('apartadoPaymentAmount').value,
        method: document.getElementById('apartadoPaymentMethod').value,
        observation: document.getElementById('apartadoPaymentObservation').value
      });
      if (!result.ok) { showToast(result.error, 'error'); return; }
      closeModal();
      renderRoute();
      showToast(result.completed ? `Apartado completado y convertido en ${result.saleReference}.` : `Abono registrado. Saldo: ${money(result.balance)}.`);
    });
  }

  function openApartadoDetail(apartadoId) {
    const state = store.getState();
    const apartado = state.apartados.find((item) => item.id === apartadoId);
    if (!apartado) { showToast('No se encontró el apartado.', 'error'); return; }
    const financial = apartadoFinancialState(apartado);
    const payments = financial.payments.length ? financial.payments.map((payment) => `<div class="payment-history-row"><div><strong>${formatDate(payment.date || payment.createdAt)}</strong><span>${escapeHtml(payment.kind || 'Abono')} · ${escapeHtml(payment.method || '—')}</span></div><strong>${money(payment.amount)}</strong></div>`).join('') : '<div class="client-history-empty">Sin pagos registrados.</div>';
    openModal(`
      <div class="modal-header"><div><p class="modal-eyebrow">APARTADO</p><h2 id="modalTitle">${escapeHtml(apartado.reference || apartado.id)}</h2><p>${escapeHtml(apartadoClientName(state, apartado))} · ${formatDate(apartado.date || apartado.createdAt)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
      <div class="modal-body">
        <div class="sale-detail-meta"><div><span>Producto</span><strong>${escapeHtml(apartadoProductName(state, apartado))}</strong></div><div><span>Variante</span><strong>${escapeHtml(apartado.variantSnapshot?.label || '—')}</strong></div><div><span>Cantidad</span><strong>${quantity(apartado.quantity)}</strong></div><div><span>Precio</span><strong>${money(apartado.unitPrice)}</strong></div><div><span>Estado</span><strong><span class="status-pill status-pill--${apartadoStatusClass(financial.statusKey)}">${financial.status}</span></strong></div></div>
        <section class="payment-balance-strip"><div><span>Total</span><strong>${money(financial.total)}</strong></div><div><span>Pagado</span><strong>${money(financial.paid)}</strong></div><div class="payment-balance-strip__accent"><span>Saldo</span><strong>${money(financial.balance)}</strong></div></section>
        <section class="payment-history-block"><div class="payment-history-heading"><h3>Historial de pagos</h3><span>${quantity(financial.payments.length)}</span></div><div class="payment-history-list">${payments}</div></section>
        ${apartado.observation ? `<p class="form-hint"><strong>Observación:</strong> ${escapeHtml(apartado.observation)}</p>` : ''}
        ${isApartadoCompleted(apartado) ? `<p class="sale-history-note">Convertido en venta ${escapeHtml(apartado.saleReference || apartado.saleId || '—')}. La reserva fue liberada y la existencia física se descontó una sola vez.</p>` : ''}
        ${isApartadoCancelled(apartado) && financial.paid > 0.005 ? `<p class="sale-history-note">Cancelado con ${money(financial.paid)} pagados. La devolución de dinero queda sin resolver automáticamente, según la política del negocio.</p>` : ''}
      </div>
      <div class="modal-footer">${isApartadoActive(apartado) && financial.balance > 0.005 ? `<button class="button button--primary" type="button" data-action="pay-apartado" data-apartado-id="${apartado.id}">Registrar abono</button>` : ''}<button class="button button--secondary" type="button" data-action="close-modal">Cerrar</button></div>`, 'modal--large');
  }

  function postSaleOperationNumber(state) {
    return state.operacionesPostVenta.reduce((max, item) => Math.max(max, Number(item.operationNumber) || 0), 0) + 1;
  }

  function postSaleReference(number) {
    return `OP-${String(number).padStart(6, '0')}`;
  }

  function isPostSaleOperationCancelled(operation) {
    return ['cancelado', 'cancelada', 'anulado', 'anulada'].includes(String(operation?.status || '').toLowerCase());
  }

  function usedQuantityForSaleLine(state, saleId, lineId) {
    return state.operacionesPostVenta
      .filter((operation) => !isPostSaleOperationCancelled(operation))
      .filter((operation) => String(operation.saleId) === String(saleId) && String(operation.sourceLineId) === String(lineId))
      .reduce((sum, operation) => sum + Math.max(0, Number.parseInt(operation.quantity, 10) || 0), 0);
  }

  function returnableQuantityForLine(state, sale, line) {
    return Math.max(0, (Number.parseInt(line.quantity, 10) || 0) - usedQuantityForSaleLine(state, sale.id, line.id));
  }

  function originalNetUnitPrice(line) {
    const qty = Math.max(1, Number.parseInt(line?.quantity, 10) || 1);
    const lineTotal = Number(line?.lineTotal);
    if (Number.isFinite(lineTotal)) return Math.max(0, lineTotal / qty);
    return Math.max(0, (Number(line?.salePrice) || 0) - (Number(line?.unitDiscount) || 0));
  }

  function saleHasReturnableLines(state, sale) {
    return !isSaleCancelled(sale) && (sale.lines || []).some((line) => returnableQuantityForLine(state, sale, line) > 0);
  }

  function postSaleTypeLabel(type) {
    return type === 'cambio' ? 'Cambio' : 'Devolución';
  }

  function renderPostSaleRow(state, operation) {
    const amount = Number(operation.difference) || 0;
    const differenceText = amount > 0.005 ? `A pagar ${money(amount)}` : amount < -0.005 ? `A favor ${money(Math.abs(amount))}` : 'Sin diferencia';
    return `<article class="post-sale-row"><div><strong>${escapeHtml(operation.reference || operation.id)} · ${postSaleTypeLabel(operation.type)}</strong><span>${formatDate(operation.date || operation.createdAt)} · ${escapeHtml(operation.saleReference || operation.saleId || 'Venta')}</span><small>${escapeHtml(operation.sourceProductName || 'Producto')} · ${escapeHtml(operation.sourceVariantLabel || '')}${operation.type === 'cambio' ? ` → ${escapeHtml(operation.targetProductName || 'Producto')} · ${escapeHtml(operation.targetVariantLabel || '')}` : ''}</small></div><div><span>Cantidad</span><strong>${quantity(operation.quantity)}</strong></div><div><span>Diferencia</span><strong class="${amount < -0.005 ? 'negative-value' : ''}">${differenceText}</strong></div><div><span class="status-pill status-pill--partial">${operation.moneyResolutionStatus === 'sin_diferencia' ? 'Sin diferencia' : 'Pendiente dinero'}</span></div><button class="button button--secondary button--compact" type="button" data-action="view-post-sale" data-operation-id="${operation.id}">Ver</button></article>`;
  }

  function commitPostSaleOperation(options) {
    const current = store.getState();
    const type = String(options.type || '').toLowerCase();
    if (!['cambio', 'devolucion'].includes(type)) return { ok: false, error: 'Tipo de operación inválido.' };
    const sale = current.ventas.find((item) => item.id === options.saleId && !isSaleCancelled(item));
    if (!sale) return { ok: false, error: 'Selecciona una venta válida.' };
    const sourceLine = (sale.lines || []).find((line) => line.id === options.sourceLineId);
    if (!sourceLine) return { ok: false, error: 'Selecciona una línea válida de la venta.' };
    const qty = Number.parseInt(options.quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: 'La cantidad debe ser un entero mayor que cero.' };
    const returnable = returnableQuantityForLine(current, sale, sourceLine);
    if (qty > returnable) return { ok: false, error: `Solo quedan ${quantity(returnable)} pieza(s) disponibles para cambio o devolución en esta línea.` };
    const sourceVariant = current.variantes.find((item) => item.id === sourceLine.variantId);
    const sourceProduct = current.productos.find((item) => item.id === sourceLine.productId);
    if (!sourceVariant || !sourceProduct) return { ok: false, error: 'El producto original ya no existe en inventario.' };
    const conditionSellable = Boolean(options.conditionSellable);
    const dateKey = String(options.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { ok: false, error: 'Selecciona una fecha válida.' };
    if (dateKey > localDateKey()) return { ok: false, error: 'La fecha no puede estar en el futuro.' };
    const originalUnit = originalNetUnitPrice(sourceLine);

    let targetProduct = null;
    let targetVariant = null;
    let targetUnit = 0;
    if (type === 'cambio') {
      targetProduct = current.productos.find((item) => item.id === options.targetProductId && item.active);
      targetVariant = current.variantes.find((item) => item.id === options.targetVariantId && item.productId === options.targetProductId);
      if (!targetProduct || !targetVariant) return { ok: false, error: 'Selecciona el producto y variante de reemplazo.' };
      if (String(targetVariant.id) === String(sourceVariant.id)) return { ok: false, error: 'Selecciona una variante o producto diferente para registrar el cambio.' };
      if (qty > availableStockForVariant(current, targetVariant.id)) return { ok: false, error: 'No hay disponibilidad suficiente de la variante de reemplazo.' };
      targetUnit = effectiveVariantSalePrice(targetProduct, targetVariant);
    }

    const difference = type === 'cambio'
      ? Math.round(((targetUnit - originalUnit) * qty + Number.EPSILON) * 100) / 100
      : Math.round((-originalUnit * qty + Number.EPSILON) * 100) / 100;
    const number = postSaleOperationNumber(current);
    const reference = postSaleReference(number);
    const operationId = uid('post');
    const now = new Date().toISOString();
    const operationDate = `${dateKey}T12:00:00`;
    let saveError = '';

    const saved = store.transact((draft) => {
      const draftSale = draft.ventas.find((item) => item.id === sale.id);
      const draftLine = draftSale?.lines?.find((line) => line.id === sourceLine.id);
      if (!draftSale || !draftLine || qty > returnableQuantityForLine(draft, draftSale, draftLine)) {
        saveError = 'La cantidad disponible para esta operación cambió antes de guardar.';
        return;
      }
      const oldVariant = draft.variantes.find((item) => item.id === sourceVariant.id);
      const newVariant = type === 'cambio' ? draft.variantes.find((item) => item.id === targetVariant.id) : null;
      if (!oldVariant || (type === 'cambio' && !newVariant)) {
        saveError = 'No se encontraron las variantes necesarias para actualizar inventario.';
        return;
      }
      if (type === 'cambio' && qty > availableStockForVariant(draft, newVariant.id)) {
        saveError = 'La variante de reemplazo ya no tiene disponibilidad suficiente.';
        return;
      }

      if (conditionSellable) {
        const beforeOld = Number(oldVariant.stock) || 0;
        oldVariant.stock = beforeOld + qty;
        oldVariant.updatedAt = now;
        draft.movimientosInventario.push({
          id: uid('mov'), date: operationDate, productId: sourceProduct.id, variantId: oldVariant.id, quantity: qty, type: 'entrada',
          reason: type === 'cambio' ? 'Reingreso por cambio' : 'Reingreso por devolución', note: `${reference} · ${sale.reference || sale.id}`,
          relatedSaleId: sale.id, relatedPostSaleId: operationId, productNameSnapshot: sourceLine.productName || sourceProduct.name,
          variantLabelSnapshot: sourceLine.variantLabel || variantLabel(oldVariant), stockBefore: beforeOld, stockAfter: oldVariant.stock, createdAt: now
        });
      }

      if (type === 'cambio') {
        const beforeNew = Number(newVariant.stock) || 0;
        newVariant.stock = beforeNew - qty;
        newVariant.updatedAt = now;
        draft.movimientosInventario.push({
          id: uid('mov'), date: operationDate, productId: targetProduct.id, variantId: newVariant.id, quantity: qty, type: 'salida',
          reason: 'Entrega por cambio', note: `${reference} · ${sale.reference || sale.id}`, relatedSaleId: sale.id, relatedPostSaleId: operationId,
          productNameSnapshot: targetProduct.name, variantLabelSnapshot: variantLabel(newVariant), stockBefore: beforeNew, stockAfter: newVariant.stock, createdAt: now
        });
      }

      draft.operacionesPostVenta.push({
        id: operationId,
        operationNumber: number,
        reference,
        type,
        changeReason: type === 'cambio' ? String(options.changeReason || 'Producto') : null,
        date: operationDate,
        saleId: sale.id,
        saleReference: sale.reference || sale.id,
        clientId: sale.clientId || null,
        clientSnapshot: sale.clientSnapshot || null,
        sourceLineId: sourceLine.id,
        sourceProductId: sourceProduct.id,
        sourceVariantId: sourceVariant.id,
        sourceProductName: sourceLine.productName || sourceProduct.name,
        sourceVariantLabel: sourceLine.variantLabel || variantLabel(sourceVariant),
        sourceUnitPrice: originalUnit,
        quantity: qty,
        conditionSellable,
        targetProductId: type === 'cambio' ? targetProduct.id : null,
        targetVariantId: type === 'cambio' ? targetVariant.id : null,
        targetProductName: type === 'cambio' ? targetProduct.name : null,
        targetVariantLabel: type === 'cambio' ? variantLabel(targetVariant) : null,
        targetUnitPrice: type === 'cambio' ? targetUnit : null,
        difference,
        moneyResolutionStatus: Math.abs(difference) <= 0.005 ? 'sin_diferencia' : 'pendiente',
        observation: String(options.observation || '').trim(),
        status: 'confirmada',
        createdAt: now,
        updatedAt: now
      });
    });
    if (!saved || saveError) return { ok: false, error: saveError || 'No se pudo guardar la operación.' };
    return { ok: true, reference, difference };
  }

  function openPostSaleForm(type) {
    const state = store.getState();
    const sales = state.ventas.filter((sale) => saleHasReturnableLines(state, sale)).slice().sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
    if (!sales.length) { showToast('No hay ventas con piezas disponibles para cambio o devolución.', 'error'); return; }
    const products = state.productos.filter((product) => product.active && productVariants(state, product.id).length).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
    const isChange = type === 'cambio';
    const today = localDateKey();
    openModal(`
      <form id="postSaleForm" novalidate>
        <div class="modal-header"><div><p class="modal-eyebrow">${isChange ? 'CAMBIOS' : 'DEVOLUCIONES'}</p><h2 id="modalTitle">${isChange ? 'Registrar cambio' : 'Registrar devolución'}</h2><p>La venta original se conserva intacta y la operación queda vinculada a ella.</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
        <div class="modal-body">
          <div class="fields-grid fields-grid--2">
            <label class="field-group"><span>Fecha *</span><input id="postSaleDate" type="date" value="${today}" max="${today}" required></label>
            <label class="field-group"><span>Venta original *</span><select id="postSaleSale" required>${sales.map((sale) => `<option value="${sale.id}">${escapeHtml(sale.reference || sale.id)} · ${escapeHtml(saleClientName(state, sale))} · ${formatDate(sale.date || sale.createdAt)}</option>`).join('')}</select></label>
            <label class="field-group field-group--wide"><span>Producto / variante devuelta *</span><select id="postSaleLine" required></select></label>
            <label class="field-group"><span>Cantidad *</span><input id="postSaleQuantity" type="number" min="1" step="1" inputmode="numeric" required></label>
            ${isChange ? `<label class="field-group"><span>Tipo de cambio *</span><select id="postSaleReason"><option value="Talla">Talla</option><option value="Color">Color</option><option value="Producto">Producto</option></select></label><label class="field-group"><span>Producto de reemplazo *</span><select id="postSaleTargetProduct" required>${products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)} · ${escapeHtml(product.internalCode || '')}</option>`).join('')}</select></label><label class="field-group"><span>Variante de reemplazo *</span><select id="postSaleTargetVariant" required></select></label>` : ''}
            <label class="field-group field-group--wide checkbox-field"><span><input id="postSaleSellable" type="checkbox" checked> La prenda devuelta está en condición vendible y debe reingresar a existencia.</span></label>
            <label class="field-group field-group--wide"><span>Observación</span><textarea id="postSaleObservation" rows="3" maxlength="500"></textarea></label>
          </div>
          <section class="post-sale-preview" id="postSalePreview"></section>
          <p class="form-hint">Las diferencias de dinero se registran como pendientes de resolver. La app no crea cobros ni devoluciones de efectivo automáticamente.</p>
        </div>
        <div class="modal-footer"><button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button><button class="button button--primary" type="submit">Guardar ${isChange ? 'cambio' : 'devolución'}</button></div>
      </form>`, 'modal--large');

    const saleSelect = document.getElementById('postSaleSale');
    const lineSelect = document.getElementById('postSaleLine');
    const qtyInput = document.getElementById('postSaleQuantity');
    const targetProductSelect = isChange ? document.getElementById('postSaleTargetProduct') : null;
    const targetVariantSelect = isChange ? document.getElementById('postSaleTargetVariant') : null;
    const preview = document.getElementById('postSalePreview');

    const refreshLines = () => {
      const current = store.getState();
      const sale = current.ventas.find((item) => item.id === saleSelect.value);
      const lines = (sale?.lines || []).filter((line) => returnableQuantityForLine(current, sale, line) > 0);
      lineSelect.innerHTML = lines.map((line) => `<option value="${line.id}">${escapeHtml(line.productName || 'Producto')} · ${escapeHtml(line.variantLabel || '')} · ${quantity(returnableQuantityForLine(current, sale, line))} disponibles para operación</option>`).join('');
      refreshPreview();
    };
    const refreshTargetVariants = () => {
      if (!isChange) return;
      const current = store.getState();
      const variants = productVariants(current, targetProductSelect.value);
      targetVariantSelect.innerHTML = variants.map((variant) => `<option value="${variant.id}">${escapeHtml(variantLabel(variant))} · ${quantity(availableStockForVariant(current, variant.id))} disponibles</option>`).join('');
      refreshPreview();
    };
    const refreshPreview = () => {
      const current = store.getState();
      const sale = current.ventas.find((item) => item.id === saleSelect.value);
      const line = sale?.lines?.find((item) => item.id === lineSelect.value);
      const qty = Math.max(0, Number.parseInt(qtyInput.value, 10) || 0);
      if (!sale || !line) { preview.innerHTML = '<span>Selecciona una línea de venta.</span>'; return; }
      const originalUnit = originalNetUnitPrice(line);
      const returnable = returnableQuantityForLine(current, sale, line);
      let difference = -originalUnit * qty;
      let targetHtml = '';
      if (isChange) {
        const product = current.productos.find((item) => item.id === targetProductSelect.value);
        const variant = current.variantes.find((item) => item.id === targetVariantSelect.value);
        const targetUnit = product && variant ? effectiveVariantSalePrice(product, variant) : 0;
        difference = (targetUnit - originalUnit) * qty;
        targetHtml = `<div><span>Precio nuevo / pieza</span><strong>${money(targetUnit)}</strong></div><div><span>Disponible nuevo</span><strong>${variant ? quantity(availableStockForVariant(current, variant.id)) : '0'}</strong></div>`;
      }
      const diffLabel = difference > 0.005 ? `A pagar ${money(difference)}` : difference < -0.005 ? `A favor ${money(Math.abs(difference))}` : 'Sin diferencia';
      preview.innerHTML = `<div><span>Precio original neto / pieza</span><strong>${money(originalUnit)}</strong></div><div><span>Máximo retornable</span><strong>${quantity(returnable)}</strong></div>${targetHtml}<div class="post-sale-preview__accent"><span>Diferencia</span><strong>${diffLabel}</strong></div>`;
    };
    saleSelect.addEventListener('change', refreshLines);
    lineSelect.addEventListener('change', refreshPreview);
    qtyInput.addEventListener('input', refreshPreview);
    if (isChange) { targetProductSelect.addEventListener('change', refreshTargetVariants); targetVariantSelect.addEventListener('change', refreshPreview); refreshTargetVariants(); }
    refreshLines();

    document.getElementById('postSaleForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const result = commitPostSaleOperation({
        type,
        date: document.getElementById('postSaleDate').value,
        saleId: saleSelect.value,
        sourceLineId: lineSelect.value,
        quantity: qtyInput.value,
        conditionSellable: document.getElementById('postSaleSellable').checked,
        changeReason: isChange ? document.getElementById('postSaleReason').value : null,
        targetProductId: isChange ? targetProductSelect.value : null,
        targetVariantId: isChange ? targetVariantSelect.value : null,
        observation: document.getElementById('postSaleObservation').value
      });
      if (!result.ok) { showToast(result.error, 'error'); return; }
      closeModal();
      renderRoute();
      const diff = result.difference;
      showToast(diff > 0.005 ? `${result.reference} guardada. Diferencia a pagar: ${money(diff)}.` : diff < -0.005 ? `${result.reference} guardada. Diferencia a favor: ${money(Math.abs(diff))}.` : `${result.reference} guardada sin diferencia de precio.`);
    });
  }

  function openPostSaleDetail(operationId) {
    const state = store.getState();
    const operation = state.operacionesPostVenta.find((item) => item.id === operationId);
    if (!operation) { showToast('No se encontró la operación.', 'error'); return; }
    const amount = Number(operation.difference) || 0;
    const differenceText = amount > 0.005 ? `A pagar ${money(amount)}` : amount < -0.005 ? `A favor ${money(Math.abs(amount))}` : 'Sin diferencia';
    openModal(`
      <div class="modal-header"><div><p class="modal-eyebrow">${postSaleTypeLabel(operation.type).toUpperCase()}</p><h2 id="modalTitle">${escapeHtml(operation.reference || operation.id)}</h2><p>${escapeHtml(operation.saleReference || operation.saleId || '')} · ${formatDate(operation.date || operation.createdAt)}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div>
      <div class="modal-body">
        <div class="sale-detail-meta"><div><span>Operación</span><strong>${postSaleTypeLabel(operation.type)}</strong></div><div><span>Cantidad</span><strong>${quantity(operation.quantity)}</strong></div><div><span>Condición</span><strong>${operation.conditionSellable ? 'Vendible / reingresa' : 'No vendible / no reingresa'}</strong></div><div><span>Diferencia</span><strong>${differenceText}</strong></div><div><span>Dinero</span><strong>${operation.moneyResolutionStatus === 'sin_diferencia' ? 'Sin diferencia' : 'Pendiente de resolver'}</strong></div></div>
        <div class="post-sale-detail-flow"><article><span>Devuelve</span><strong>${escapeHtml(operation.sourceProductName || 'Producto')}</strong><small>${escapeHtml(operation.sourceVariantLabel || '')} · ${money(operation.sourceUnitPrice)} / pieza</small></article>${operation.type === 'cambio' ? `<span class="post-sale-detail-arrow">→</span><article><span>Recibe</span><strong>${escapeHtml(operation.targetProductName || 'Producto')}</strong><small>${escapeHtml(operation.targetVariantLabel || '')} · ${money(operation.targetUnitPrice)} / pieza</small></article>` : ''}</div>
        ${operation.type === 'cambio' ? `<p class="form-hint"><strong>Tipo de cambio:</strong> ${escapeHtml(operation.changeReason || 'Producto')}</p>` : ''}
        ${operation.observation ? `<p class="form-hint"><strong>Observación:</strong> ${escapeHtml(operation.observation)}</p>` : ''}
        <p class="sale-history-note">La venta original ${escapeHtml(operation.saleReference || operation.saleId || '')} no fue borrada ni modificada de forma destructiva. Esta operación conserva su propia trazabilidad.</p>
      </div>
      <div class="modal-footer"><button class="button button--primary" type="button" data-action="close-modal">Cerrar</button></div>`, 'modal--large');
  }


  function inventorySummary(state) {
    const active = state.productos.filter((product) => product.active).length;
    const exhausted = state.productos.filter((product) => productAvailability(state, product) === 'agotado').length;
    const low = state.productos.filter((product) => isProductLow(state, product)).length;
    const physical = state.variantes.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
    const reserved = state.variantes.reduce((sum, variant) => sum + reservedStockForVariant(state, variant.id), 0);
    const available = Math.max(0, physical - reserved);
    return { active, exhausted, low, physical, reserved, available };
  }

  function renderInventory(module) {
    const state = store.getState();
    const summary = inventorySummary(state);
    const normalizedSearch = inventorySearch.trim().toLowerCase();

    const products = state.productos
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }))
      .filter((product) => {
        const variants = productVariants(state, product.id);
        const status = productAvailability(state, product);
        if (inventoryFilter === 'activos' && status !== 'activo') return false;
        if (inventoryFilter === 'agotados' && status !== 'agotado') return false;
        if (inventoryFilter === 'stock-bajo' && !isProductLow(state, product)) return false;
        if (inventoryFilter === 'inactivos' && product.active) return false;
        if (!normalizedSearch) return true;
        const haystack = [product.name, product.description, product.category, product.brand, product.internalCode]
          .concat(variants.flatMap((variant) => [variant.color, variant.size]))
          .join(' ').toLowerCase();
        return haystack.includes(normalizedSearch);
      });

    const cards = products.map((product) => renderProductCard(state, product)).join('');

    return `
      <section class="page-panel inventory-page" aria-labelledby="pageTitle">
        <div class="page-heading inventory-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div>
              <h1 id="pageTitle">Inventario</h1>
              <p>Fuente principal de productos, variantes, existencias, precios y movimientos.</p>
            </div>
          </div>
          <span class="stage-chip">V1</span>
        </div>

        <section class="inventory-summary inventory-summary--stage7" aria-label="Resumen de inventario">
          <article class="metric-card"><span>Productos activos</span><strong>${quantity(summary.active)}</strong></article>
          <article class="metric-card"><span>Existencia física</span><strong>${quantity(summary.physical)}</strong></article>
          <article class="metric-card metric-card--warning"><span>Reservada</span><strong>${quantity(summary.reserved)}</strong></article>
          <article class="metric-card metric-card--accent"><span>Disponible</span><strong>${quantity(summary.available)}</strong></article>
          <article class="metric-card metric-card--warning"><span>Stock bajo</span><strong>${quantity(summary.low)}</strong></article>
          <article class="metric-card metric-card--danger"><span>Agotados</span><strong>${quantity(summary.exhausted)}</strong></article>
        </section>

        <div class="inventory-toolbar">
          <div class="inventory-toolbar__actions">
            <button class="button button--primary" type="button" data-action="add-product">＋ Agregar producto</button>
            <button class="button button--secondary" type="button" data-action="adjust-stock" ${state.productos.length ? '' : 'disabled'}>↕ Ajustar inventario</button>
          </div>
          <div class="inventory-toolbar__filters">
            <label class="search-field">
              <span class="sr-only">Buscar producto</span>
              <input type="search" id="inventorySearch" placeholder="Buscar producto, código, talla o color…" value="${escapeHtml(inventorySearch)}" autocomplete="off">
            </label>
            <label class="select-field">
              <span class="sr-only">Filtrar inventario</span>
              <select id="inventoryFilter">
                <option value="todos" ${inventoryFilter === 'todos' ? 'selected' : ''}>Todos</option>
                <option value="activos" ${inventoryFilter === 'activos' ? 'selected' : ''}>Activos</option>
                <option value="stock-bajo" ${inventoryFilter === 'stock-bajo' ? 'selected' : ''}>Stock bajo</option>
                <option value="agotados" ${inventoryFilter === 'agotados' ? 'selected' : ''}>Agotados</option>
                <option value="inactivos" ${inventoryFilter === 'inactivos' ? 'selected' : ''}>Inactivos</option>
              </select>
            </label>
          </div>
        </div>

        <div class="inventory-list-heading">
          <div>
            <h2>Productos</h2>
            <p>${products.length === 1 ? '1 producto visible' : `${products.length} productos visibles`}</p>
          </div>
        </div>

        <section class="product-grid" id="productGrid" aria-live="polite">
          ${cards || renderInventoryEmpty(state)}
        </section>
      </section>
      <div id="modalRoot"></div>
    `;
  }

  function renderInventoryEmpty(state) {
    if (!state.productos.length) {
      return `
        <div class="inventory-empty">
          <div class="inventory-empty__icon">▦</div>
          <h3>Inventario listo para empezar</h3>
          <p>Agrega el primer producto con sus precios, foto y variantes. La existencia inicial quedará registrada en el historial.</p>
          <button class="button button--primary" type="button" data-action="add-product">Agregar primer producto</button>
        </div>`;
    }
    return `
      <div class="inventory-empty">
        <div class="inventory-empty__icon">⌕</div>
        <h3>Sin coincidencias</h3>
        <p>No hay productos que coincidan con la búsqueda o filtro actual.</p>
        <button class="button button--secondary" type="button" data-action="clear-filters">Limpiar filtros</button>
      </div>`;
  }

  function renderProductCard(state, product) {
    const variants = productVariants(state, product.id);
    const stock = totalStock(state, product.id);
    const reserved = totalReservedStock(state, product.id);
    const available = totalAvailableStock(state, product.id);
    const status = productAvailability(state, product);
    const low = isProductLow(state, product);
    const utility = (Number(product.salePrice) || 0) - (Number(product.purchasePrice) || 0);
    const statusLabel = status === 'activo' ? 'Activo' : status === 'agotado' ? 'Agotado' : 'Inactivo';
    const expanded = expandedInventoryProductIds.has(String(product.id));
    const detailId = `inventory-product-detail-${String(product.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const variantRows = variants.map((variant) => {
      const variantReserved = reservedStockForVariant(state, variant.id);
      const variantAvailable = availableStockForVariant(state, variant.id);
      return `
      <div class="variant-chip ${isVariantLow(state, product, variant) ? 'variant-chip--low' : ''}">
        <span>${escapeHtml(variantLabel(variant))}</span>
        <strong>${quantity(variantAvailable)} disp.</strong>
        ${variantReserved ? `<small>${quantity(variantReserved)} reserv.</small>` : ''}
      </div>`;
    }).join('');

    return `
      <article class="product-card ${expanded ? 'is-expanded' : ''}" data-product-id="${product.id}">
        <button class="product-summary-row" type="button" data-action="toggle-inventory-product" data-product-id="${product.id}" aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="${detailId}">
          <span class="product-summary-row__name" title="${escapeHtml(product.name || 'Producto')}">${escapeHtml(product.name || 'Producto')}</span>
          <span class="product-summary-row__metric product-summary-row__stock"><span>Stock</span><strong>${product.active ? quantity(available) : '0'}</strong></span>
          <span class="product-summary-row__metric product-summary-row__purchase"><span>Compra</span><strong>${money(product.purchasePrice)}</strong></span>
          <span class="product-summary-row__metric product-summary-row__sale"><span>Venta</span><strong>${money(product.salePrice)}</strong></span>
          <span class="product-summary-row__metric product-summary-row__variants"><span>Variantes</span><strong>${quantity(variants.length)}</strong></span>
          <span class="product-summary-row__chevron" aria-hidden="true">${expanded ? '⌄' : '›'}</span>
        </button>

        <div class="product-detail" id="${detailId}" ${expanded ? '' : 'hidden'}>
          <button class="product-photo" type="button" data-action="view-photo" data-product-id="${product.id}" aria-label="Ver foto de ${escapeHtml(product.name)}">
            <span class="product-photo__placeholder">${PLACEHOLDER_PHOTO}</span>
            <img class="product-photo__image" data-photo-product="${product.id}" alt="${escapeHtml(product.name)}" hidden>
          </button>

          <div class="product-card__body">
            <div class="product-card__topline">
              <div class="product-title-wrap">
                <p class="product-code">${escapeHtml(product.internalCode || 'SIN CÓDIGO')}</p>
                <h3>${escapeHtml(product.name || 'Producto')}</h3>
              </div>
              <div class="status-stack">
                <span class="status-chip status-chip--${status}">${statusLabel}</span>
                ${low ? '<span class="status-chip status-chip--low">Stock bajo</span>' : ''}
              </div>
            </div>

            <p class="product-meta">${escapeHtml(product.category || 'Sin categoría')}${product.brand ? ` · ${escapeHtml(product.brand)}` : ''}</p>
            ${product.description ? `<p class="product-description">${escapeHtml(product.description)}</p>` : ''}

            <div class="price-strip">
              <div><span>Compra</span><strong>${money(product.purchasePrice)}</strong></div>
              <div><span>Venta</span><strong>${money(product.salePrice)}</strong></div>
              <div><span>Utilidad potencial</span><strong class="${utility < 0 ? 'negative-value' : ''}">${money(utility)}</strong></div>
            </div>

            <div class="stock-row stock-row--reservation">
              <div class="stock-total"><span>Existencia física</span><strong>${quantity(stock)}</strong></div>
              <div class="stock-reserved"><span>Reservada</span><strong>${quantity(reserved)}</strong></div>
              <div class="stock-available"><span>Disponible</span><strong>${product.active ? quantity(available) : '0'}</strong></div>
              <div class="stock-threshold"><span>Umbral base</span><strong>${quantity(product.lowStockThreshold)}</strong></div>
            </div>

            <div class="variant-list" aria-label="Existencia por variante">
              ${variantRows || '<span class="muted-text">Sin variantes registradas.</span>'}
            </div>

            <div class="product-card__actions">
              <button class="compact-action" type="button" data-action="edit-product" data-product-id="${product.id}" title="Editar producto">✎ <span>Editar</span></button>
              <button class="compact-action" type="button" data-action="product-history" data-product-id="${product.id}" title="Ver historial">◷ <span>Historial</span></button>
              <button class="compact-action" type="button" data-action="adjust-stock-product" data-product-id="${product.id}" title="Ajustar inventario">↕ <span>Ajustar</span></button>
              <button class="compact-action ${product.active ? 'compact-action--danger' : 'compact-action--success'}" type="button" data-action="toggle-product" data-product-id="${product.id}">${product.active ? '⊘ <span>Desactivar</span>' : '✓ <span>Activar</span>'}</button>
            </div>
          </div>
        </div>
      </article>`;
  }


  function catalogVariantData(state, product, mode = 'completo') {
    const variants = productVariants(state, product.id).map((variant) => ({
      ...variant,
      available: availableStockForVariant(state, variant.id),
      reserved: reservedStockForVariant(state, variant.id),
      salePrice: effectiveVariantSalePrice(product, variant)
    }));
    return mode === 'disponibles' ? variants.filter((variant) => variant.available > 0) : variants;
  }

  function uniqueCatalogValues(values) {
    const seen = new Set();
    return values
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .filter((value) => {
        const key = value.toLocaleLowerCase('es');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function catalogPriceText(product, variants) {
    const prices = uniqueCatalogValues((variants.length ? variants.map((variant) => variant.salePrice) : [product.salePrice])
      .map((value) => Number(value).toFixed(2)))
      .map(Number)
      .sort((a, b) => a - b);
    if (!prices.length) return money(product.salePrice);
    if (prices.length === 1) return money(prices[0]);
    return `${money(prices[0])} – ${money(prices[prices.length - 1])}`;
  }

  function catalogProductData(state, product, mode = 'completo') {
    const allVariants = catalogVariantData(state, product, 'completo');
    const visibleVariants = catalogVariantData(state, product, mode);
    const available = totalAvailableStock(state, product.id);
    const valuesSource = mode === 'disponibles' ? visibleVariants : allVariants;
    return {
      product,
      variants: visibleVariants,
      allVariants,
      available,
      sizes: uniqueCatalogValues(valuesSource.map((variant) => variant.size)),
      colors: uniqueCatalogValues(valuesSource.map((variant) => variant.color)),
      price: catalogPriceText(product, valuesSource),
      availableLabel: available > 0 ? `${quantity(available)} disponible${available === 1 ? '' : 's'}` : 'Agotado'
    };
  }

  function catalogProducts(state, mode = 'completo') {
    return state.productos
      .filter((product) => product.active)
      .filter((product) => mode !== 'disponibles' || totalAvailableStock(state, product.id) > 0)
      .slice()
      .sort((a, b) => {
        const categoryCompare = String(a.category || '').localeCompare(String(b.category || ''), 'es', { sensitivity: 'base' });
        return categoryCompare || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
      });
  }

  function catalogListText(values, fallback = '—') {
    return values.length ? values.join(' · ') : fallback;
  }

  function renderCatalogVariant(variant) {
    const exhausted = variant.available <= 0;
    return `
      <span class="catalog-variant ${exhausted ? 'catalog-variant--exhausted' : ''}">
        <span>${escapeHtml(variantLabel(variant))}</span>
        <strong>${exhausted ? 'Agotada' : `${quantity(variant.available)} disp.`}</strong>
      </span>`;
  }

  function renderCatalogCard(state, product, mode) {
    const data = catalogProductData(state, product, mode);
    const availabilityClass = data.available > 0 ? 'is-available' : 'is-exhausted';
    return `
      <article class="catalog-card" data-catalog-product="${product.id}">
        <button class="catalog-card__photo" type="button" data-action="view-photo" data-product-id="${product.id}" aria-label="Ver foto de ${escapeHtml(product.name || 'producto')}">
          <span class="catalog-card__placeholder">${PLACEHOLDER_PHOTO}</span>
          <img data-photo-product="${product.id}" alt="${escapeHtml(product.name || 'Producto')}" hidden>
          <span class="catalog-availability ${availabilityClass}">${data.available > 0 ? 'Disponible' : 'Agotado'}</span>
        </button>
        <div class="catalog-card__body">
          <p class="catalog-card__category">${escapeHtml(product.category || 'Moda')}</p>
          <h2>${escapeHtml(product.name || 'Producto')}</h2>
          ${product.description ? `<p class="catalog-card__description">${escapeHtml(product.description)}</p>` : ''}
          <strong class="catalog-card__price">${escapeHtml(data.price)}</strong>
          <dl class="catalog-specs">
            <div><dt>Tallas</dt><dd>${escapeHtml(catalogListText(data.sizes, 'Sin talla'))}</dd></div>
            <div><dt>Colores</dt><dd>${escapeHtml(catalogListText(data.colors, 'Sin color'))}</dd></div>
            <div><dt>Disponibilidad</dt><dd>${escapeHtml(data.availableLabel)}</dd></div>
          </dl>
          ${data.variants.length ? `<div class="catalog-variants" aria-label="Variantes comerciales">${data.variants.map(renderCatalogVariant).join('')}</div>` : '<p class="catalog-no-variants">Sin variantes registradas.</p>'}
        </div>
      </article>`;
  }

  function renderCatalog(module) {
    const state = store.getState();
    const identity = getBusinessIdentity(state);
    const identityDisplayName = businessIdentityDisplayName(identity);
    const catalogLogoSrc = businessIdentityHorizontalLogoSrc(identity);
    const contacts = businessIdentityContactItems(identity);
    const products = catalogProducts(state, catalogMode);
    const activeCount = state.productos.filter((product) => product.active).length;
    const availableCount = state.productos.filter((product) => product.active && totalAvailableStock(state, product.id) > 0).length;
    return `
      <section class="page-panel catalog-page" aria-labelledby="pageTitle">
        <div class="page-heading catalog-heading">
          <div class="page-heading__left">
            <span class="page-heading__icon" aria-hidden="true">${module.icon}</span>
            <div>
              <h1 id="pageTitle">Catálogo</h1>
              <p>Vista comercial alimentada directamente por Inventario y Apartados.</p>
            </div>
          </div>
          <span class="stage-chip">V1</span>
        </div>

        <section class="catalog-brand-panel" aria-label="${escapeHtml(identityDisplayName)}">
          <div class="catalog-brand-panel__copy">
            <p>CATÁLOGO COMERCIAL</p>
            <h2 title="${escapeHtml(identityDisplayName)}">${escapeHtml(identityDisplayName)}</h2>
            ${identity.slogan ? `<span>${escapeHtml(identity.slogan)}</span>` : ''}
            ${identity.ownerName ? `<small class="catalog-brand-panel__owner">Propietario: ${escapeHtml(identity.ownerName)}</small>` : ''}
            ${contacts.length ? `<div class="catalog-brand-panel__contacts">${contacts.map((item) => `<small>${escapeHtml(item)}</small>`).join('')}</div>` : ''}
          </div>
          <div class="catalog-brand-panel__logo"><img data-business-logo="true" src="${catalogLogoSrc}" alt="${escapeHtml(identityDisplayName)}"></div>
        </section>

        <div class="catalog-toolbar">
          <div class="catalog-view-switch" role="group" aria-label="Vista del catálogo">
            <button class="catalog-switch ${catalogMode === 'completo' ? 'is-active' : ''}" type="button" data-action="catalog-mode" data-mode="completo">Catálogo completo</button>
            <button class="catalog-switch ${catalogMode === 'disponibles' ? 'is-active' : ''}" type="button" data-action="catalog-mode" data-mode="disponibles">Solo disponibles</button>
          </div>
          <div class="catalog-export-actions" aria-label="Exportar catálogo">
            <button class="button button--secondary" type="button" data-action="export-catalog-pdf" data-mode="completo">PDF completo</button>
            <button class="button button--primary" type="button" data-action="export-catalog-pdf" data-mode="disponibles">PDF solo disponibles</button>
          </div>
        </div>

        <div class="catalog-summary-line">
          <span>${quantity(activeCount)} producto${activeCount === 1 ? '' : 's'} activo${activeCount === 1 ? '' : 's'}</span>
          <span>${quantity(availableCount)} con disponibilidad real</span>
          <span>${catalogMode === 'disponibles' ? 'Mostrando únicamente existencias disponibles' : 'Mostrando catálogo comercial completo'}</span>
        </div>

        <section class="catalog-grid" aria-live="polite">
          ${products.length ? products.map((product) => renderCatalogCard(state, product, catalogMode)).join('') : `
            <div class="catalog-empty">
              <span>◫</span>
              <h2>${catalogMode === 'disponibles' ? 'No hay productos disponibles' : 'No hay productos activos'}</h2>
              <p>${catalogMode === 'disponibles' ? 'Las existencias físicas están agotadas o reservadas en Apartados.' : 'Activa productos desde Inventario para publicarlos en el catálogo.'}</p>
            </div>`}
        </section>
      </section>
      <div id="modalRoot"></div>`;
  }

  function loadImageElement(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo cargar una imagen del catálogo.'));
      image.src = source;
    });
  }

  async function loadBusinessLogoElement(source) {
    try {
      return await loadImageElement(source);
    } catch (error) {
      if (String(source || '') === PROMETEO_LOGO_PATH) throw error;
      console.warn('[PROMETEO] Falló el logo comercial; se usará el fallback PROMETEO para el PDF.', error);
      return loadImageElement(PROMETEO_LOGO_PATH);
    }
  }

  async function loadProductImage(productId) {
    const blob = await photoStore.get(productId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    try {
      return await loadImageElement(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function drawImageContain(ctx, image, x, y, width, height) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    let drawWidth = width;
    let drawHeight = height;
    if (sourceRatio > targetRatio) drawHeight = width / sourceRatio;
    else drawWidth = height * sourceRatio;
    const dx = x + (width - drawWidth) / 2;
    const dy = y + (height - drawHeight) / 2;
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let line = words.shift();
    words.forEach((word) => {
      const candidate = `${line} ${word}`;
      if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
      else { lines.push(line); line = word; }
    });
    lines.push(line);
    return lines;
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
    const lines = wrapCanvasText(ctx, text, maxWidth);
    const visible = lines.slice(0, maxLines);
    visible.forEach((line, index) => {
      let value = line;
      const needsEllipsis = (index === maxLines - 1 && lines.length > maxLines) || ctx.measureText(value).width > maxWidth;
      if (needsEllipsis) {
        while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
        value = `${value}…`;
      }
      ctx.fillText(value, x, y + (index * lineHeight));
    });
    return y + (visible.length * lineHeight);
  }

  function roundRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function pdfPageCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    return canvas;
  }

  function drawPdfPageBase(ctx, identity) {
    ctx.fillStyle = '#fcfaf6';
    ctx.fillRect(0, 0, 1240, 1754);
    ctx.fillStyle = '#081f45';
    ctx.fillRect(0, 0, 1240, 22);
    ctx.fillStyle = '#c79a43';
    ctx.fillRect(92, 1645, 1056, 2);
    ctx.font = '24px Arial, sans-serif';
    ctx.fillStyle = '#6e7682';
    ctx.textAlign = 'center';
    drawWrappedText(ctx, businessIdentityDisplayName(identity), 620, 1694, 940, 28, 1);
    ctx.textAlign = 'left';
  }

  async function buildCatalogCoverPage(mode, logo, identity) {
    const canvas = pdfPageCanvas();
    const ctx = canvas.getContext('2d');
    drawPdfPageBase(ctx, identity);
    ctx.fillStyle = '#081f45';
    ctx.fillRect(92, 165, 1056, 1180);
    ctx.fillStyle = '#c79a43';
    ctx.fillRect(92, 165, 1056, 10);
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, 210, 300, 820, 300, 36);
    ctx.fill();
    drawImageContain(ctx, logo, 285, 345, 670, 210);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '52px Georgia, serif';
    drawWrappedText(ctx, businessIdentityDisplayName(identity), 620, 680, 850, 58, 2);
    ctx.fillStyle = '#d7b368';
    ctx.font = '700 28px Arial, sans-serif';
    ctx.fillText('CATÁLOGO', 620, 800);
    ctx.fillStyle = '#ffffff';
    ctx.font = '58px Georgia, serif';
    ctx.fillText(mode === 'disponibles' ? 'Solo disponibles' : 'Colección completa', 620, 890);
    let identityMetaY = 955;
    if (identity.slogan) {
      ctx.font = '28px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      identityMetaY = drawWrappedText(ctx, identity.slogan, 620, identityMetaY, 820, 38, 2) + 38;
    }
    const contactText = businessIdentityContactItems(identity).join(' · ');
    if (contactText) {
      ctx.font = '22px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.70)';
      identityMetaY = drawWrappedText(ctx, contactText, 620, identityMetaY, 850, 30, 2) + 34;
    }
    if (identity.ownerName) {
      ctx.font = '22px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.70)';
      identityMetaY = drawWrappedText(ctx, `Propietario: ${identity.ownerName}`, 620, identityMetaY, 850, 30, 2) + 34;
    }
    ctx.fillStyle = '#d7b368';
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText(new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()), 620, Math.min(identityMetaY + 30, 1245));
    ctx.textAlign = 'left';
    return canvas;
  }

  async function buildCatalogProductPage(state, product, mode, logo, identity, variantChunk, pageIndex, pageCount) {
    const canvas = pdfPageCanvas();
    const ctx = canvas.getContext('2d');
    drawPdfPageBase(ctx, identity);
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, 92, 70, 1056, 1450, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,31,69,.10)';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawImageContain(ctx, logo, 90, 82, 330, 112);
    ctx.fillStyle = '#c79a43';
    ctx.fillRect(92, 206, 1056, 3);

    const data = catalogProductData(state, product, mode);
    const photo = pageIndex === 0 ? await loadProductImage(product.id) : null;
    const photoY = 250;
    const photoHeight = pageIndex === 0 ? 580 : 120;
    if (pageIndex === 0) {
      ctx.fillStyle = '#f7f1e7';
      roundRectPath(ctx, 150, photoY, 940, photoHeight, 28);
      ctx.fill();
      if (photo) drawImageContain(ctx, photo, 170, photoY + 20, 900, photoHeight - 40);
      else {
        ctx.fillStyle = '#c79a43';
        ctx.font = '58px Georgia, serif';
        ctx.textAlign = 'center';
        drawWrappedText(ctx, businessIdentityDisplayName(identity), 620, photoY + 245, 760, 62, 2);
        ctx.font = '26px Arial, sans-serif';
        ctx.fillStyle = '#6e7682';
        ctx.fillText('Foto no disponible', 620, photoY + 370);
        ctx.textAlign = 'left';
      }
    } else {
      ctx.fillStyle = '#f7f1e7';
      roundRectPath(ctx, 150, photoY, 940, photoHeight, 22);
      ctx.fill();
      ctx.fillStyle = '#081f45';
      ctx.font = '700 28px Arial, sans-serif';
      ctx.fillText(`Variantes · continuación ${pageIndex + 1}/${pageCount}`, 190, photoY + 72);
    }

    let y = pageIndex === 0 ? 890 : 430;
    ctx.fillStyle = '#c79a43';
    ctx.font = '700 24px Arial, sans-serif';
    ctx.fillText(String(product.category || 'Moda').toUpperCase(), 150, y);
    y += 62;
    ctx.fillStyle = '#081f45';
    ctx.font = '58px Georgia, serif';
    y = drawWrappedText(ctx, product.name || 'Producto', 150, y, 940, 65, 2) + 12;
    ctx.fillStyle = '#c79a43';
    ctx.font = '700 42px Arial, sans-serif';
    ctx.fillText(data.price, 150, y);
    y += 68;
    if (product.description) {
      ctx.fillStyle = '#4f5865';
      ctx.font = '28px Arial, sans-serif';
      y = drawWrappedText(ctx, product.description, 150, y, 940, 40, pageIndex === 0 ? 3 : 2) + 20;
    }

    ctx.font = '700 24px Arial, sans-serif';
    ctx.fillStyle = '#081f45';
    ctx.fillText('TALLAS', 150, y);
    ctx.fillText('COLORES', 560, y);
    ctx.fillText('DISPONIBILIDAD', 930, y);
    y += 34;
    ctx.font = '26px Arial, sans-serif';
    ctx.fillStyle = '#4f5865';
    drawWrappedText(ctx, catalogListText(data.sizes, 'Sin talla'), 150, y, 350, 34, 2);
    drawWrappedText(ctx, catalogListText(data.colors, 'Sin color'), 560, y, 310, 34, 2);
    ctx.fillStyle = data.available > 0 ? '#226443' : '#a33d3d';
    ctx.font = '700 26px Arial, sans-serif';
    drawWrappedText(ctx, data.availableLabel, 930, y, 170, 34, 2);
    y += 100;

    if (variantChunk.length) {
      ctx.fillStyle = '#081f45';
      ctx.font = '700 25px Arial, sans-serif';
      ctx.fillText('VARIANTES', 150, y);
      y += 34;
      variantChunk.forEach((variant) => {
        ctx.fillStyle = variant.available > 0 ? '#f7f1e7' : '#f3f1ee';
        roundRectPath(ctx, 150, y, 940, 54, 14);
        ctx.fill();
        ctx.fillStyle = variant.available > 0 ? '#081f45' : '#7f8185';
        ctx.font = '25px Arial, sans-serif';
        ctx.fillText(variantLabel(variant), 174, y + 36);
        ctx.textAlign = 'right';
        ctx.font = '700 24px Arial, sans-serif';
        ctx.fillText(variant.available > 0 ? `${quantity(variant.available)} disponible${variant.available === 1 ? '' : 's'}` : 'Agotada', 1066, y + 36);
        ctx.textAlign = 'left';
        y += 64;
      });
    }
    return canvas;
  }

  function canvasToJpegBytes(canvas, quality = 0.88) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) { reject(new Error('No se pudo convertir una página del PDF.')); return; }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, 'image/jpeg', quality);
    });
  }

  function concatByteArrays(chunks) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.length; });
    return output;
  }

  function asciiBytes(text) {
    return new TextEncoder().encode(text);
  }

  function createPdfFromJpegs(images, pixelWidth = 1240, pixelHeight = 1754) {
    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const objectCount = 2 + (images.length * 3);
    const objects = new Array(objectCount + 1);
    objects[1] = asciiBytes('<< /Type /Catalog /Pages 2 0 R >>');
    const pageIds = images.map((_, index) => 3 + (index * 3));
    objects[2] = asciiBytes(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${images.length} >>`);
    images.forEach((image, index) => {
      const pageId = 3 + (index * 3);
      const imageId = pageId + 1;
      const contentId = pageId + 2;
      objects[pageId] = asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      const imageHeader = asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);
      objects[imageId] = concatByteArrays([imageHeader, image, asciiBytes('\nendstream')]);
      const stream = `q\n${PAGE_W} 0 0 ${PAGE_H} 0 0 cm\n/Im0 Do\nQ`;
      objects[contentId] = asciiBytes(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });

    const chunks = [asciiBytes('%PDF-1.4\n')];
    const offsets = new Array(objectCount + 1).fill(0);
    let cursor = chunks[0].length;
    for (let id = 1; id <= objectCount; id += 1) {
      offsets[id] = cursor;
      const prefix = asciiBytes(`${id} 0 obj\n`);
      const suffix = asciiBytes('\nendobj\n');
      chunks.push(prefix, objects[id], suffix);
      cursor += prefix.length + objects[id].length + suffix.length;
    }
    const xrefOffset = cursor;
    let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= objectCount; id += 1) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(asciiBytes(xref), asciiBytes(trailer));
    return new Blob(chunks, { type: 'application/pdf' });
  }

  async function exportCatalogPdf(mode, button) {
    const state = store.getState();
    const identity = getBusinessIdentity(state);
    const products = catalogProducts(state, mode);
    if (!products.length) {
      showToast(mode === 'disponibles' ? 'No hay productos con disponibilidad real para exportar.' : 'No hay productos activos para exportar.', 'error');
      return;
    }
    const originalText = button?.textContent || '';
    if (button) { button.disabled = true; button.textContent = 'Generando PDF…'; }
    try {
      const logo = await loadBusinessLogoElement(businessIdentityHorizontalLogoSrc(identity));
      const pages = [];
      pages.push(await buildCatalogCoverPage(mode, logo, identity));
      for (const product of products) {
        const variants = catalogVariantData(state, product, mode);
        const chunks = variants.length ? Array.from({ length: Math.ceil(variants.length / 8) }, (_, index) => variants.slice(index * 8, (index + 1) * 8)) : [[]];
        for (let index = 0; index < chunks.length; index += 1) {
          pages.push(await buildCatalogProductPage(state, product, mode, logo, identity, chunks[index], index, chunks.length));
        }
      }
      const jpegPages = [];
      for (const canvas of pages) jpegPages.push(await canvasToJpegBytes(canvas));
      const pdf = createPdfFromJpegs(jpegPages);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      const stamp = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      link.href = url;
      link.download = `${businessIdentityFilenameToken(identity)}_Catalogo_${mode === 'disponibles' ? 'Solo_Disponibles' : 'Completo'}_${stamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast(`PDF ${mode === 'disponibles' ? 'solo disponibles' : 'completo'} generado.`);
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText; }
    }
  }

  function showToast(message, type = 'success') {
    let region = document.getElementById('toastRegion');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toastRegion';
      region.className = 'toast-region';
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), type === 'error' ? 5000 : 3000);
  }

  function modalRoot() {
    return document.getElementById('modalRoot');
  }

  function syncModalViewportHeight() {
    const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight;
    if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
      document.documentElement.style.setProperty('--doren-modal-viewport-height', `${Math.round(viewportHeight)}px`);
    }
  }

  function closeModal(force = false) {
    const root = modalRoot();
    const dangerModal = root?.querySelector('[data-danger-delete-modal="true"]');
    if (!force && dangerModal && dangerDeleteFlow.busy) return false;
    if (!force && dangerModal && dangerDeleteFlow.phase !== 'prepared') {
      const backupStillFresh = hasFreshDangerBackupAuthorization(dangerDeleteFlow.operationId || null);
      dangerDeleteFlow = {
        phase: backupStillFresh ? 'backup-completed' : 'backup-required',
        operationId: backupStillFresh ? dangerBackupAuthorization?.operationId || null : null,
        keywordValid: false,
        busy: false,
        preparedAt: null,
        completedAt: null
      };
    }
    if (root) root.innerHTML = '';
    document.body.classList.remove('modal-open');
    document.documentElement.style.removeProperty('--doren-modal-viewport-height');
    return true;
  }

  function openModal(content, className = '') {
    const root = modalRoot();
    if (!root) return;
    syncModalViewportHeight();
    root.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="modalTitle" data-modal-panel>
          ${content}
        </section>
      </div>`;
    document.body.classList.add('modal-open');
    normalizeNumericInputs(root);
    const first = root.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
    if (first) setTimeout(() => first.focus(), 0);
  }

  const refreshModalViewportHeight = () => {
    if (document.body.classList.contains('modal-open')) syncModalViewportHeight();
  };
  window.addEventListener('resize', refreshModalViewportHeight, { passive: true });
  window.visualViewport?.addEventListener('resize', refreshModalViewportHeight, { passive: true });
  window.visualViewport?.addEventListener('scroll', refreshModalViewportHeight, { passive: true });

  function renderVariantEditorRow(variant = {}, isExisting = false) {
    return `
      <div class="variant-editor-row" data-variant-row data-existing="${isExisting ? 'true' : 'false'}" data-variant-id="${escapeHtml(variant.id || '')}">
        <label class="field-group">
          <span>Talla</span>
          <input type="text" name="variantSize" value="${escapeHtml(variant.size || '')}" placeholder="Ej. M" maxlength="30">
        </label>
        <label class="field-group">
          <span>Color</span>
          <input type="text" name="variantColor" value="${escapeHtml(variant.color || '')}" placeholder="Ej. Negro" maxlength="50">
        </label>
        <label class="field-group">
          <span>${isExisting ? 'Existencia' : 'Existencia inicial'}</span>
          <input type="number" name="variantStock" value="${isExisting ? String(Math.max(0, Number.parseInt(variant.stock, 10) || 0)) : ''}" min="0" step="1" inputmode="numeric" ${isExisting ? 'readonly' : ''}>
        </label>
        <label class="field-group">
          <span>Umbral</span>
          <input type="number" name="variantThreshold" value="${variant.lowStockThreshold ?? ''}" min="0" step="1" inputmode="numeric" placeholder="Usar base">
        </label>
        <button class="icon-text-button icon-text-button--danger" type="button" data-action="remove-variant" ${isExisting ? 'disabled title="Las variantes existentes no se borran desde edición; déjalas en 0 mediante Ajustar."' : ''}>× <span>Quitar</span></button>
      </div>`;
  }

  async function openProductForm(productId = null) {
    const state = store.getState();
    const product = productId ? state.productos.find((item) => item.id === productId) : null;
    const variants = product ? productVariants(state, product.id) : [];
    const existingPhoto = product ? await photoStore.get(product.id) : null;
    let existingPhotoUrl = '';
    if (existingPhoto) {
      existingPhotoUrl = URL.createObjectURL(existingPhoto);
      objectUrls.add(existingPhotoUrl);
    }
    const utility = product ? (Number(product.salePrice) || 0) - (Number(product.purchasePrice) || 0) : 0;

    openModal(`
      <form id="productForm" novalidate>
        <div class="modal-header">
          <div>
            <p class="modal-eyebrow">INVENTARIO</p>
            <h2 id="modalTitle">${product ? 'Editar producto' : 'Agregar producto'}</h2>
            <p>${product ? 'El stock de variantes existentes se modifica únicamente desde Ajustar inventario para conservar historial.' : 'Registra información comercial, foto y existencia inicial.'}</p>
          </div>
          <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
        </div>

        <div class="modal-body product-form-grid">
          <section class="form-section form-section--photo">
            <h3>Foto</h3>
            <div class="photo-picker">
              <div class="photo-picker__preview" id="photoPreview">
                ${existingPhotoUrl ? `<img src="${existingPhotoUrl}" alt="Foto actual de ${escapeHtml(product.name)}">` : PLACEHOLDER_PHOTO}
              </div>
              <div class="photo-picker__controls">
                <label class="button button--secondary file-button">
                  Seleccionar foto
                  <input type="file" id="productPhoto" accept="image/*" hidden>
                </label>
                ${product && existingPhoto ? '<button class="text-button text-button--danger" type="button" id="removePhotoButton">Quitar foto</button>' : ''}
                <p>La foto se guarda localmente en IndexedDB para conservarse al recargar.</p>
              </div>
            </div>
          </section>

          <section class="form-section">
            <h3>Datos del producto</h3>
            <div class="fields-grid fields-grid--2">
              <label class="field-group field-group--wide">
                <span>Nombre *</span>
                <input type="text" id="productName" value="${escapeHtml(product?.name || '')}" required maxlength="120" autocomplete="off">
              </label>
              <label class="field-group">
                <span>Categoría *</span>
                <input type="text" id="productCategory" value="${escapeHtml(product?.category || '')}" required maxlength="80" autocomplete="off">
              </label>
              <label class="field-group">
                <span>Marca <small>(opcional)</small></span>
                <input type="text" id="productBrand" value="${escapeHtml(product?.brand || '')}" maxlength="80" autocomplete="off">
              </label>
              <label class="field-group">
                <span>Código interno *</span>
                <input type="text" id="productCode" value="${escapeHtml(product?.internalCode || '')}" required maxlength="50" autocomplete="off">
              </label>
              <label class="field-group">
                <span>Umbral base de stock bajo *</span>
                <input type="number" id="productThreshold" value="${product ? String(Math.max(0, Number.parseInt(product.lowStockThreshold, 10) || 0)) : ''}" min="0" step="1" inputmode="numeric" required>
              </label>
              <label class="field-group field-group--wide">
                <span>Descripción</span>
                <textarea id="productDescription" rows="3" maxlength="500">${escapeHtml(product?.description || '')}</textarea>
              </label>
            </div>
          </section>

          <section class="form-section">
            <h3>Precios</h3>
            <div class="fields-grid fields-grid--3 price-fields">
              <label class="field-group">
                <span>Precio de compra *</span>
                <div class="money-input"><span>C$</span><input type="number" id="purchasePrice" value="${product ? moneyInputValue(product.purchasePrice) : ''}" min="0" step="0.01" inputmode="decimal" required></div>
              </label>
              <label class="field-group">
                <span>Precio de venta *</span>
                <div class="money-input"><span>C$</span><input type="number" id="salePrice" value="${product ? moneyInputValue(product.salePrice) : ''}" min="0" step="0.01" inputmode="decimal" required></div>
              </label>
              <div class="utility-preview">
                <span>Utilidad potencial unitaria</span>
                <strong id="utilityPreview" class="${utility < 0 ? 'negative-value' : ''}">${money(utility)}</strong>
              </div>
            </div>
            <p class="form-hint">No se calcula porcentaje de margen. Estos precios serán la base para futuros snapshots de venta sin modificar históricos.</p>
          </section>

          <section class="form-section">
            <div class="form-section__heading">
              <div>
                <h3>Variantes</h3>
                <p>Talla, color y existencia por variante. Si no aplica talla/color, puede dejar ambos campos vacíos.</p>
              </div>
              <button class="button button--secondary button--compact" type="button" data-action="add-variant">＋ Variante</button>
            </div>
            <div class="variant-editor" id="variantEditor">
              ${(variants.length ? variants.map((variant) => renderVariantEditorRow(variant, true)) : [renderVariantEditorRow({}, false)]).join('')}
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button>
          <button class="button button--primary" type="submit">${product ? 'Guardar cambios' : 'Guardar producto'}</button>
        </div>
      </form>
    `, 'modal--large');

    const form = document.getElementById('productForm');
    const purchase = document.getElementById('purchasePrice');
    const sale = document.getElementById('salePrice');
    const preview = document.getElementById('utilityPreview');
    const photoInput = document.getElementById('productPhoto');
    const photoPreview = document.getElementById('photoPreview');
    let removePhoto = false;

    const recalcUtility = () => {
      const value = (Number(sale.value) || 0) - (Number(purchase.value) || 0);
      preview.textContent = money(value);
      preview.classList.toggle('negative-value', value < 0);
    };
    purchase.addEventListener('input', recalcUtility);
    sale.addEventListener('input', recalcUtility);

    photoInput.addEventListener('change', () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Selecciona un archivo de imagen válido.', 'error');
        photoInput.value = '';
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        showToast('La foto no debe superar 8 MB.', 'error');
        photoInput.value = '';
        return;
      }
      const url = URL.createObjectURL(file);
      objectUrls.add(url);
      photoPreview.innerHTML = `<img src="${url}" alt="Vista previa de la foto">`;
      removePhoto = false;
    });

    const removeButton = document.getElementById('removePhotoButton');
    if (removeButton) {
      removeButton.addEventListener('click', () => {
        removePhoto = true;
        photoInput.value = '';
        photoPreview.innerHTML = PLACEHOLDER_PHOTO;
        removeButton.hidden = true;
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const variantRows = [...document.querySelectorAll('[data-variant-row]')];
      const variantData = variantRows.map((row) => ({
        id: row.dataset.variantId || null,
        existing: row.dataset.existing === 'true',
        size: row.querySelector('[name="variantSize"]').value.trim(),
        color: row.querySelector('[name="variantColor"]').value.trim(),
        stock: Math.max(0, Number.parseInt(row.querySelector('[name="variantStock"]').value, 10) || 0),
        lowStockThreshold: row.querySelector('[name="variantThreshold"]').value === '' ? null : Math.max(0, Number.parseInt(row.querySelector('[name="variantThreshold"]').value, 10) || 0)
      }));

      const purchasePriceInput = document.getElementById('purchasePrice');
      const salePriceInput = document.getElementById('salePrice');
      const productThresholdInput = document.getElementById('productThreshold');
      const purchasePriceRaw = purchasePriceInput.value.trim();
      const salePriceRaw = salePriceInput.value.trim();
      const productThresholdRaw = productThresholdInput.value.trim();
      const data = {
        name: document.getElementById('productName').value.trim(),
        description: document.getElementById('productDescription').value.trim(),
        category: document.getElementById('productCategory').value.trim(),
        brand: document.getElementById('productBrand').value.trim(),
        internalCode: document.getElementById('productCode').value.trim(),
        purchasePrice: purchasePriceRaw === '' ? NaN : Number(purchasePriceRaw),
        salePrice: salePriceRaw === '' ? NaN : Number(salePriceRaw),
        lowStockThreshold: productThresholdRaw === '' ? NaN : Math.max(0, Number.parseInt(productThresholdRaw, 10))
      };

      if (!data.name || !data.category || !data.internalCode || !Number.isFinite(data.purchasePrice) || !Number.isFinite(data.salePrice) || !Number.isInteger(data.lowStockThreshold) || data.purchasePrice < 0 || data.salePrice < 0 || data.lowStockThreshold < 0) {
        showToast('Completa correctamente nombre, categoría, código, umbral y precios.', 'error');
        return;
      }
      if (!variantData.length) {
        showToast('El producto necesita al menos una variante o existencia base.', 'error');
        return;
      }

      const duplicateVariantKey = new Set();
      for (const variant of variantData) {
        const key = `${variant.color.toLowerCase()}|${variant.size.toLowerCase()}`;
        if (duplicateVariantKey.has(key)) {
          showToast('No repitas la misma combinación de talla y color.', 'error');
          return;
        }
        duplicateVariantKey.add(key);
      }

      const current = store.getState();
      const duplicateCode = current.productos.some((item) => item.id !== productId && String(item.internalCode || '').trim().toLowerCase() === data.internalCode.toLowerCase());
      if (duplicateCode) {
        showToast('El código interno ya pertenece a otro producto.', 'error');
        return;
      }

      const now = new Date().toISOString();
      const targetId = productId || uid('prod');
      const success = store.transact((draft) => {
        if (productId) {
          const index = draft.productos.findIndex((item) => item.id === productId);
          if (index < 0) return;
          draft.productos[index] = {
            ...draft.productos[index],
            ...data,
            updatedAt: now
          };
          variantData.forEach((variant) => {
            if (variant.existing && variant.id) {
              const vIndex = draft.variantes.findIndex((item) => item.id === variant.id && item.productId === productId);
              if (vIndex >= 0) {
                draft.variantes[vIndex] = {
                  ...draft.variantes[vIndex],
                  size: variant.size,
                  color: variant.color,
                  lowStockThreshold: variant.lowStockThreshold,
                  updatedAt: now
                };
              }
            } else {
              const variantId = uid('var');
              draft.variantes.push({
                id: variantId,
                productId,
                size: variant.size,
                color: variant.color,
                stock: variant.stock,
                lowStockThreshold: variant.lowStockThreshold,
                purchasePriceOverride: null,
                salePriceOverride: null,
                createdAt: now,
                updatedAt: now
              });
              if (variant.stock > 0) {
                draft.movimientosInventario.push({
                  id: uid('mov'),
                  date: now,
                  productId,
                  variantId,
                  quantity: variant.stock,
                  type: 'entrada',
                  reason: 'Inventario inicial',
                  note: 'Existencia inicial de nueva variante.',
                  productNameSnapshot: data.name,
                  variantLabelSnapshot: variantLabel(variant),
                  createdAt: now
                });
              }
            }
          });
        } else {
          draft.productos.push({
            id: targetId,
            ...data,
            active: true,
            photoMeta: null,
            createdAt: now,
            updatedAt: now
          });
          variantData.forEach((variant) => {
            const variantId = uid('var');
            draft.variantes.push({
              id: variantId,
              productId: targetId,
              size: variant.size,
              color: variant.color,
              stock: variant.stock,
              lowStockThreshold: variant.lowStockThreshold,
              purchasePriceOverride: null,
              salePriceOverride: null,
              createdAt: now,
              updatedAt: now
            });
            if (variant.stock > 0) {
              draft.movimientosInventario.push({
                id: uid('mov'),
                date: now,
                productId: targetId,
                variantId,
                quantity: variant.stock,
                type: 'entrada',
                reason: 'Inventario inicial',
                note: 'Existencia registrada al crear el producto.',
                productNameSnapshot: data.name,
                variantLabelSnapshot: variantLabel(variant),
                createdAt: now
              });
            }
          });
        }
      });

      if (!success) {
        showToast('No se pudo guardar el producto.', 'error');
        return;
      }

      try {
        const file = photoInput.files?.[0];
        if (removePhoto) {
          await photoStore.remove(targetId);
          store.transact((draft) => {
            const item = draft.productos.find((entry) => entry.id === targetId);
            if (item) item.photoMeta = null;
          });
        } else if (file) {
          await photoStore.put(targetId, file);
          store.transact((draft) => {
            const item = draft.productos.find((entry) => entry.id === targetId);
            if (item) item.photoMeta = { name: file.name, type: file.type, size: file.size, updatedAt: new Date().toISOString() };
          });
        }
      } catch (error) {
        console.error('[DOREN] Producto guardado, pero falló la foto.', error);
        showToast('Producto guardado, pero no se pudo persistir la foto.', 'error');
      }

      closeModal();
      renderRoute();
      showToast(productId ? 'Producto actualizado.' : 'Producto creado.');
    });
  }

  function openAdjustmentModal(preselectedProductId = '') {
    const state = store.getState();
    const products = state.productos.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
    if (!products.length) {
      showToast('Primero agrega un producto.', 'error');
      return;
    }
    const selectedId = preselectedProductId || products[0].id;

    openModal(`
      <form id="adjustmentForm" novalidate>
        <div class="modal-header">
          <div>
            <p class="modal-eyebrow">MOVIMIENTO MANUAL</p>
            <h2 id="modalTitle">Ajustar inventario</h2>
            <p>Cada entrada o salida queda registrada en el historial. Las salidas nunca pueden dejar stock negativo.</p>
          </div>
          <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body">
          <div class="fields-grid fields-grid--2">
            <label class="field-group">
              <span>Fecha *</span>
              <input type="datetime-local" id="adjustmentDate" required>
            </label>
            <label class="field-group">
              <span>Producto *</span>
              <select id="adjustmentProduct" required>${products.map((product) => `<option value="${product.id}" ${product.id === selectedId ? 'selected' : ''}>${escapeHtml(product.name)} · ${escapeHtml(product.internalCode || '')}</option>`).join('')}</select>
            </label>
            <label class="field-group">
              <span>Variante *</span>
              <select id="adjustmentVariant" required></select>
            </label>
            <label class="field-group">
              <span>Tipo *</span>
              <select id="adjustmentType" required>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </label>
            <label class="field-group">
              <span>Cantidad *</span>
              <input type="number" id="adjustmentQuantity" min="1" step="1" inputmode="numeric" required>
            </label>
            <label class="field-group">
              <span>Motivo *</span>
              <select id="adjustmentReason" required>${INVENTORY_REASONS.map((reason) => `<option>${reason}</option>`).join('')}</select>
            </label>
            <label class="field-group field-group--wide">
              <span>Observación</span>
              <textarea id="adjustmentNote" rows="3" maxlength="500" placeholder="Detalle opcional del ajuste"></textarea>
            </label>
          </div>
          <div class="stock-preview" id="stockPreview"></div>
        </div>
        <div class="modal-footer">
          <button class="button button--ghost" type="button" data-action="close-modal">Cancelar</button>
          <button class="button button--primary" type="submit">Guardar ajuste</button>
        </div>
      </form>`, 'modal--medium');

    const dateInput = document.getElementById('adjustmentDate');
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    dateInput.value = localNow;

    const productSelect = document.getElementById('adjustmentProduct');
    const variantSelect = document.getElementById('adjustmentVariant');
    const qtyInput = document.getElementById('adjustmentQuantity');
    const typeSelect = document.getElementById('adjustmentType');
    const stockPreview = document.getElementById('stockPreview');

    const updateVariants = () => {
      const currentState = store.getState();
      const variants = productVariants(currentState, productSelect.value);
      variantSelect.innerHTML = variants.map((variant) => `<option value="${variant.id}">${escapeHtml(variantLabel(variant))} · ${quantity(availableStockForVariant(state, variant.id))} disponibles</option>`).join('');
      updateStockPreview();
    };

    const updateStockPreview = () => {
      const currentState = store.getState();
      const variant = currentState.variantes.find((item) => item.id === variantSelect.value);
      if (!variant) {
        stockPreview.innerHTML = '<span>Sin variante disponible.</span>';
        return;
      }
      const qty = Math.max(0, Number.parseInt(qtyInput.value, 10) || 0);
      const before = Number(variant.stock) || 0;
      const reserved = reservedStockForVariant(currentState, variant.id);
      const available = Math.max(0, before - reserved);
      const after = typeSelect.value === 'salida' ? before - qty : before + qty;
      const afterAvailable = Math.max(0, after - reserved);
      stockPreview.innerHTML = `<span>Existencia física <strong>${quantity(before)}</strong></span><span>Reservada <strong>${quantity(reserved)}</strong></span><span>Disponible <strong>${quantity(available)}</strong></span><span>Después <strong class="${after < reserved ? 'negative-value' : ''}">${quantity(after)}</strong> física / ${quantity(afterAvailable)} disponible</span>`;
    };

    productSelect.addEventListener('change', updateVariants);
    variantSelect.addEventListener('change', updateStockPreview);
    qtyInput.addEventListener('input', updateStockPreview);
    typeSelect.addEventListener('change', updateStockPreview);
    updateVariants();

    document.getElementById('adjustmentForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const currentState = store.getState();
      const productId = productSelect.value;
      const variantId = variantSelect.value;
      const variant = currentState.variantes.find((item) => item.id === variantId && item.productId === productId);
      const qty = Number.parseInt(qtyInput.value, 10);
      if (!variant || !Number.isFinite(qty) || qty <= 0) {
        showToast('Selecciona una variante y una cantidad válida.', 'error');
        return;
      }
      if (typeSelect.value === 'salida' && qty > availableStockForVariant(currentState, variant.id)) {
        showToast('La salida supera la existencia disponible; hay unidades reservadas que no pueden tocarse.', 'error');
        return;
      }
      const rawDate = dateInput.value;
      const movementDate = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
      const reason = document.getElementById('adjustmentReason').value;
      const note = document.getElementById('adjustmentNote').value.trim();
      const type = typeSelect.value;
      const success = store.transact((draft) => {
        const target = draft.variantes.find((item) => item.id === variantId && item.productId === productId);
        if (!target) return;
        target.stock = Math.max(0, (Number(target.stock) || 0) + (type === 'entrada' ? qty : -qty));
        target.updatedAt = new Date().toISOString();
        draft.movimientosInventario.push({
          id: uid('mov'),
          date: movementDate,
          productId,
          variantId,
          quantity: qty,
          type,
          reason,
          note,
          productNameSnapshot: draft.productos.find((item) => item.id === productId)?.name || '',
          variantLabelSnapshot: variantLabel(target),
          createdAt: new Date().toISOString()
        });
      });
      if (!success) {
        showToast('No se pudo guardar el ajuste.', 'error');
        return;
      }
      closeModal();
      renderRoute();
      showToast(type === 'entrada' ? 'Entrada registrada.' : 'Salida registrada.');
    });
  }

  function openHistoryModal(productId) {
    const state = store.getState();
    const product = state.productos.find((item) => item.id === productId);
    if (!product) return;
    const variants = productVariants(state, productId);
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const movements = state.movimientosInventario
      .filter((movement) => movement.productId === productId)
      .slice()
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

    openModal(`
      <div class="modal-header">
        <div>
          <p class="modal-eyebrow">HISTORIAL DE INVENTARIO</p>
          <h2 id="modalTitle">${escapeHtml(product.name)}</h2>
          <p>${escapeHtml(product.internalCode || '')} · Existencia actual: ${quantity(totalStock(state, productId))}</p>
        </div>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body">
        ${movements.length ? `
          <div class="history-list">
            ${movements.map((movement) => {
              const variant = variantMap.get(movement.variantId);
              return `
                <article class="history-item">
                  <div class="history-item__icon history-item__icon--${movement.type}">${movement.type === 'entrada' ? '＋' : '−'}</div>
                  <div class="history-item__main">
                    <div class="history-item__top">
                      <strong>${movement.type === 'entrada' ? 'Entrada' : 'Salida'} · ${quantity(movement.quantity)}</strong>
                      <time>${formatDate(movement.date || movement.createdAt, true)}</time>
                    </div>
                    <p>${escapeHtml(movement.variantLabelSnapshot || (variant ? variantLabel(variant) : 'Variante histórica'))} · ${escapeHtml(movement.reason || 'Sin motivo')}</p>
                    ${movement.note ? `<small>${escapeHtml(movement.note)}</small>` : ''}
                  </div>
                </article>`;
            }).join('')}
          </div>` : '<div class="modal-empty">Este producto todavía no tiene movimientos registrados.</div>'}
      </div>
      <div class="modal-footer"><button class="button button--primary" type="button" data-action="close-modal">Cerrar</button></div>
    `, 'modal--medium');
  }

  async function openPhotoModal(productId) {
    const state = store.getState();
    const product = state.productos.find((item) => item.id === productId);
    if (!product) return;
    const blob = await photoStore.get(productId);
    let photoHtml = `<div class="photo-full-placeholder">${PLACEHOLDER_PHOTO}<p>Este producto no tiene foto.</p></div>`;
    if (blob) {
      const url = URL.createObjectURL(blob);
      objectUrls.add(url);
      photoHtml = `<img class="photo-full" src="${url}" alt="Foto de ${escapeHtml(product.name)}">`;
    }
    openModal(`
      <div class="modal-header">
        <div><p class="modal-eyebrow">FOTO DEL PRODUCTO</p><h2 id="modalTitle">${escapeHtml(product.name)}</h2></div>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body photo-full-wrap">${photoHtml}</div>
      <div class="modal-footer"><button class="button button--primary" type="button" data-action="close-modal">Cerrar</button></div>`, 'modal--photo');
  }

  async function hydrateProductPhotos() {
    const images = [...document.querySelectorAll('[data-photo-product]')];
    await Promise.all(images.map(async (img) => {
      const blob = await photoStore.get(img.dataset.photoProduct);
      if (!blob || !document.body.contains(img)) return;
      const url = URL.createObjectURL(blob);
      objectUrls.add(url);
      img.src = url;
      img.hidden = false;
      const placeholder = img.previousElementSibling;
      if (placeholder) placeholder.hidden = true;
    }));
  }

  function toggleProduct(productId) {
    const state = store.getState();
    const product = state.productos.find((item) => item.id === productId);
    if (!product) return;
    store.transact((draft) => {
      const item = draft.productos.find((entry) => entry.id === productId);
      if (item) {
        item.active = !item.active;
        item.updatedAt = new Date().toISOString();
      }
    });
    renderRoute();
    showToast(product.active ? 'Producto desactivado.' : 'Producto activado.');
  }

  function updateActiveNavigation(route) {
    document.querySelectorAll('[data-route]').forEach((link) => {
      const active = link.dataset.route === route;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function clearObjectUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  }

  function renderRoute() {
    clearObjectUrls();
    const route = safeRoute();
    if (lastRenderedRoute === 'configuracion' && route !== 'configuracion') resetDangerBackupAuthorization();
    if (route === 'inventario' && lastRenderedRoute !== 'inventario') expandedInventoryProductIds.clear();
    lastRenderedRoute = route;
    const module = modules.find((item) => item.id === route) || modules[0];
    const identity = getBusinessIdentity();
    syncGlobalIdentityShell(identity);
    els.currentSection.textContent = module.label;
    document.title = `${module.label} · ${identity.appName || APP.name}`;
    updateActiveNavigation(route);

    if (route === 'inicio') els.content.innerHTML = renderHome();
    else if (route === 'inventario') {
      els.content.innerHTML = renderInventory(module);
      hydrateProductPhotos();
    } else if (route === 'clientes') {
      els.content.innerHTML = renderClients(module);
    } else if (route === 'ventas') {
      els.content.innerHTML = renderSales(module);
    } else if (route === 'cobros') {
      els.content.innerHTML = renderCollections(module);
    } else if (route === 'compras') {
      els.content.innerHTML = renderPurchases(module);
    } else if (route === 'proveedores') {
      els.content.innerHTML = renderProviders(module);
    } else if (route === 'apartados') {
      els.content.innerHTML = renderApartados(module);
    } else if (route === 'gastos') {
      els.content.innerHTML = renderExpenses(module);
    } else if (route === 'catalogo') {
      els.content.innerHTML = renderCatalog(module);
      hydrateProductPhotos();
    } else if (route === 'configuracion') {
      els.content.innerHTML = renderConfiguration(module);
      refreshPwaStatusUi();
      syncServiceWorkerState(swRegistration);
    } else els.content.innerHTML = renderPlaceholder(module);

    armBusinessLogoFallbacks(els.content);
    closeMenu();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function openMenu() {
    els.sidebar.classList.add('is-open');
    els.scrim.classList.add('is-open');
    els.menuButton.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    els.sidebar.classList.remove('is-open');
    els.scrim.classList.remove('is-open');
    els.menuButton.setAttribute('aria-expanded', 'false');
    if (!document.body.classList.contains('modal-open')) document.body.style.overflow = '';
  }

  function handleContentClick(event) {
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;
    const productId = actionTarget.dataset.productId;
    const clientId = actionTarget.dataset.clientId;

    if (action === 'add-product') openProductForm();
    if (action === 'toggle-inventory-product') {
      const key = String(productId || '');
      if (key) {
        if (expandedInventoryProductIds.has(key)) expandedInventoryProductIds.delete(key);
        else expandedInventoryProductIds.add(key);
        const module = modules.find((item) => item.id === 'inventario');
        els.content.innerHTML = renderInventory(module);
        hydrateProductPhotos();
        const toggler = Array.from(els.content.querySelectorAll('[data-action="toggle-inventory-product"]')).find((item) => String(item.dataset.productId || '') === key);
        if (toggler) toggler.focus({ preventScroll: true });
      }
    }
    if (action === 'edit-product') openProductForm(productId);
    if (action === 'adjust-stock') openAdjustmentModal();
    if (action === 'adjust-stock-product') openAdjustmentModal(productId);
    if (action === 'product-history') openHistoryModal(productId);
    if (action === 'view-photo') openPhotoModal(productId);
    if (action === 'toggle-product') toggleProduct(productId);
    if (action === 'add-client') openClientForm();
    if (action === 'edit-client') openClientForm(clientId);
    if (action === 'view-client') {
      selectedClientId = clientId;
      renderRoute();
    }
    if (action === 'clients-back') {
      selectedClientId = null;
      renderRoute();
    }
    if (action === 'copy-client-state') copyClientState(clientId);
    if (action === 'new-sale') openSaleForm();
    if (action === 'view-sale') openSaleDetail(actionTarget.dataset.saleId);
    if (action === 'view-debt') openDebtDetail(actionTarget.dataset.saleId);
    if (action === 'collect-sale') {
      const saleId = actionTarget.dataset.saleId;
      closeModal();
      openPaymentForm(saleId);
    }
    if (action === 'add-provider') openProviderForm();
    if (action === 'edit-provider') openProviderForm(actionTarget.dataset.providerId);
    if (action === 'view-provider') {
      selectedProviderId = actionTarget.dataset.providerId;
      renderRoute();
    }
    if (action === 'providers-back') {
      selectedProviderId = null;
      renderRoute();
    }
    if (action === 'new-purchase') openPurchaseForm(actionTarget.dataset.providerId || '');
    if (action === 'view-purchase') openPurchaseDetail(actionTarget.dataset.purchaseId);
    if (action === 'pay-purchase') {
      const purchaseId = actionTarget.dataset.purchaseId;
      closeModal();
      openSupplierPaymentForm(purchaseId);
    }
    if (action === 'new-apartado') openApartadoForm();
    if (action === 'view-apartado') openApartadoDetail(actionTarget.dataset.apartadoId);
    if (action === 'pay-apartado') {
      const apartadoId = actionTarget.dataset.apartadoId;
      closeModal();
      openApartadoPaymentForm(apartadoId);
    }
    if (action === 'cancel-apartado') {
      const apartadoId = actionTarget.dataset.apartadoId;
      const current = store.getState();
      const apartado = current.apartados.find((item) => item.id === apartadoId);
      if (!apartado) {
        showToast('No se encontró el apartado.', 'error');
      } else if (window.confirm(`¿Cancelar ${apartado.reference || 'este apartado'}? La mercadería reservada volverá a estar disponible y el historial se conservará.`)) {
        const result = cancelApartado(apartadoId);
        if (!result.ok) showToast(result.error, 'error');
        else {
          closeModal();
          renderRoute();
          showToast(result.paid > 0.005 ? `Apartado cancelado. ${money(result.paid)} pagados quedan sin devolución automática.` : 'Apartado cancelado y reserva liberada.');
        }
      }
    }
    if (action === 'new-change') openPostSaleForm('cambio');
    if (action === 'new-return') openPostSaleForm('devolucion');
    if (action === 'view-post-sale') openPostSaleDetail(actionTarget.dataset.operationId);
    if (action === 'add-expense') openExpenseForm();
    if (action === 'edit-expense') { closeModal(); openExpenseForm(actionTarget.dataset.expenseId); }
    if (action === 'view-expense') openExpenseDetail(actionTarget.dataset.expenseId);
    if (action === 'manage-expense-categories') openExpenseCategories();
    if (action === 'catalog-mode') {
      const requestedMode = actionTarget.dataset.mode === 'disponibles' ? 'disponibles' : 'completo';
      if (catalogMode !== requestedMode) {
        catalogMode = requestedMode;
        renderRoute();
      }
    }
    if (action === 'export-catalog-pdf') {
      const requestedMode = actionTarget.dataset.mode === 'disponibles' ? 'disponibles' : 'completo';
      exportCatalogPdf(requestedMode, actionTarget).catch((error) => {
        console.error('[DOREN] No se pudo generar el catálogo PDF.', error);
        showToast('No se pudo generar el PDF del catálogo.', 'error');
      });
    }
    if (action === 'save-business-identity') saveBusinessIdentity(actionTarget);
    if (action === 'restore-prometeo-identity') restorePrometeoIdentity(actionTarget);
    if (action === 'remove-identity-logo') stageIdentityLogoRemoval(actionTarget.dataset.logoKind || '');
    if (action === 'export-backup') exportBackup(actionTarget);
    if (action === 'export-danger-backup') exportBackup(actionTarget, { dangerOperation: true });
    if (action === 'open-danger-delete-warning') openDangerDeleteWarning();
    if (action === 'review-danger-delete') reviewDangerDeleteConfirmation();
    if (action === 'prepare-danger-delete') prepareDangerDeleteFlow();
    if (action === 'choose-backup-import') document.getElementById('backupImportInput')?.click();
    if (action === 'install-pwa') installPwa().catch((error) => { console.error('[DOREN] No se pudo iniciar la instalación PWA.', error); showToast('No se pudo iniciar la instalación.', 'error'); });
    if (action === 'check-pwa-update') checkPwaUpdate(actionTarget);
    if (action === 'clear-client-search') {
      clientSearch = '';
      renderRoute();
    }
    if (action === 'clear-filters') {
      inventorySearch = '';
      inventoryFilter = 'todos';
      renderRoute();
    }
    if (action === 'add-variant') {
      const editor = document.getElementById('variantEditor');
      if (editor) editor.insertAdjacentHTML('beforeend', renderVariantEditorRow({}, false));
    }
    if (action === 'remove-variant') {
      const row = actionTarget.closest('[data-variant-row]');
      const editor = document.getElementById('variantEditor');
      if (row && editor && editor.querySelectorAll('[data-variant-row]').length > 1) row.remove();
      else if (row) showToast('Debe quedar al menos una variante.', 'error');
    }
    if (action === 'close-modal') {
      if (actionTarget.classList.contains('modal-backdrop')) {
        if (event.target === actionTarget) closeModal();
      } else {
        closeModal();
      }
    }
  }

  function handleContentInput(event) {
    if (event.target.id === 'dangerDeleteKeyword') {
      const exact = event.target.value === 'BORRAR';
      dangerDeleteFlow.keywordValid = exact;
      const reviewButton = document.getElementById('dangerDeleteReviewButton');
      const status = document.getElementById('dangerDeleteKeywordStatus');
      if (reviewButton) {
        reviewButton.disabled = !exact || dangerDeleteFlow.busy;
        reviewButton.setAttribute('aria-disabled', reviewButton.disabled ? 'true' : 'false');
      }
      if (status) {
        status.textContent = exact ? 'BORRAR validado. Puedes continuar a la confirmación final.' : 'BORRAR pendiente.';
        status.classList.toggle('is-valid', exact);
      }
    }
    if (['identityAppName', 'identityBusinessName', 'identityOwnerName', 'identitySlogan'].includes(event.target.id)) refreshBusinessIdentityPreview();
    if (event.target.id === 'inventorySearch') {
      inventorySearch = event.target.value;
      const caret = event.target.selectionStart;
      const module = modules.find((item) => item.id === 'inventario');
      els.content.innerHTML = renderInventory(module);
      hydrateProductPhotos();
      const input = document.getElementById('inventorySearch');
      if (input) {
        input.focus();
        input.setSelectionRange(caret, caret);
      }
    }
    if (event.target.id === 'clientSearch') {
      clientSearch = event.target.value;
      const caret = event.target.selectionStart;
      const module = modules.find((item) => item.id === 'clientes');
      els.content.innerHTML = renderClients(module);
      const input = document.getElementById('clientSearch');
      if (input) {
        input.focus();
        if (typeof caret === 'number') input.setSelectionRange(caret, caret);
      }
    }
    if (event.target.id === 'saleSearch') {
      saleSearch = event.target.value;
      const caret = event.target.selectionStart;
      const module = modules.find((item) => item.id === 'ventas');
      els.content.innerHTML = renderSales(module);
      const input = document.getElementById('saleSearch');
      if (input) {
        input.focus();
        if (typeof caret === 'number') input.setSelectionRange(caret, caret);
      }
    }
    if (event.target.id === 'collectionSearch') {
      collectionSearch = event.target.value;
      const caret = event.target.selectionStart;
      const module = modules.find((item) => item.id === 'cobros');
      els.content.innerHTML = renderCollections(module);
      const input = document.getElementById('collectionSearch');
      if (input) {
        input.focus();
        if (typeof caret === 'number') input.setSelectionRange(caret, caret);
      }
    }
    if (event.target.id === 'providerSearch') {
      providerSearch = event.target.value;
      const caret = event.target.selectionStart;
      const module = modules.find((item) => item.id === 'proveedores');
      els.content.innerHTML = renderProviders(module);
      const input = document.getElementById('providerSearch');
      if (input) {
        input.focus();
        if (typeof caret === 'number') input.setSelectionRange(caret, caret);
      }
    }
    if (event.target.id === 'purchaseSearch') {
      purchaseSearch = event.target.value;
      const caret = event.target.selectionStart;
      const module = modules.find((item) => item.id === 'compras');
      els.content.innerHTML = renderPurchases(module);
      const input = document.getElementById('purchaseSearch');
      if (input) {
        input.focus();
        if (typeof caret === 'number') input.setSelectionRange(caret, caret);
      }
    }
  }

  function handleContentChange(event) {
    if (event.target.id === 'identityMainLogoInput') stageIdentityLogoFromInput('main', event.target);
    if (event.target.id === 'identityHorizontalLogoInput') stageIdentityLogoFromInput('horizontal', event.target);
    if (event.target.id === 'backupImportInput') {
      const file = event.target.files?.[0] || null;
      event.target.value = '';
      importBackupFile(file);
    }
    if (event.target.id === 'inventoryFilter') {
      inventoryFilter = event.target.value;
      renderRoute();
    }
    if (event.target.id === 'saleTypeFilter') {
      saleTypeFilter = event.target.value;
      renderRoute();
    }
    if (event.target.id === 'collectionStatusFilter') {
      collectionStatusFilter = event.target.value;
      renderRoute();
    }
    if (event.target.id === 'purchaseTypeFilter') {
      purchaseTypeFilter = event.target.value;
      renderRoute();
    }
    if (event.target.id === 'purchaseStatusFilter') {
      purchaseStatusFilter = event.target.value;
      renderRoute();
    }
    if (event.target.id === 'summaryMonth') {
      summaryMonth = event.target.value;
      renderRoute();
    }
    if (event.target.id === 'summaryYear') {
      summaryYear = event.target.value;
      renderRoute();
    }
    if (event.target.id === 'expenseMonth') {
      expenseMonth = event.target.value;
      renderRoute();
    }
    if (event.target.id === 'expenseYear') {
      expenseYear = event.target.value;
      renderRoute();
    }
  }

  function serviceWorkerStatusLabel() {
    if (!('serviceWorker' in navigator) || swRuntimeState.phase === 'unsupported') return 'No compatible';
    if (swRuntimeState.phase === 'error') return 'Error de registro';
    if (swRuntimeState.phase === 'active') return 'Activo';
    if (swRuntimeState.phase === 'updating') return 'Actualizando';
    if (swRuntimeState.phase === 'registered') return 'Preparado';
    if (swRuntimeState.phase === 'initializing') return 'Registrando';
    return 'Preparado';
  }

  function refreshPwaStatusUi() {
    const status = document.getElementById('pwaSwStatus');
    if (status) status.textContent = serviceWorkerStatusLabel();
    const connection = document.getElementById('pwaConnectionStatus');
    if (connection) connection.textContent = navigator.onLine ? 'En línea' : 'Sin conexión';
  }

  function setServiceWorkerRuntimeState(phase, error = null) {
    const changed = swRuntimeState.phase !== phase || swRuntimeState.error !== error;
    swRuntimeState.phase = phase;
    swRuntimeState.error = error;
    if (changed) refreshPwaStatusUi();
  }

  function serviceWorkerScriptMatches(worker, targetUrl) {
    if (!worker?.scriptURL) return false;
    try {
      const current = new URL(worker.scriptURL, document.baseURI);
      const target = new URL(targetUrl, document.baseURI);
      return current.origin === target.origin && current.pathname === target.pathname;
    } catch (error) {
      return false;
    }
  }

  function serviceWorkerRegistrationWorkers(registration) {
    if (!registration) return [];
    return [registration.active, registration.waiting, registration.installing].filter(Boolean);
  }

  function registrationHasRootWorker(registration) {
    if (!registration) return false;
    let scopeMatches = false;
    try { scopeMatches = new URL(registration.scope).href === SW_SCOPE_URL; }
    catch (error) { scopeMatches = false; }
    return scopeMatches && serviceWorkerRegistrationWorkers(registration)
      .some((worker) => serviceWorkerScriptMatches(worker, SW_ROOT_SCRIPT_URL));
  }

  function registrationHasLegacyWorker(registration) {
    return serviceWorkerRegistrationWorkers(registration)
      .some((worker) => serviceWorkerScriptMatches(worker, SW_LEGACY_SCRIPT_URL));
  }

  function rootControllerIsActive() {
    return serviceWorkerScriptMatches(navigator.serviceWorker?.controller, SW_ROOT_SCRIPT_URL);
  }

  function legacyControllerIsActive() {
    return serviceWorkerScriptMatches(navigator.serviceWorker?.controller, SW_LEGACY_SCRIPT_URL);
  }

  function syncServiceWorkerState(registration = swRegistration) {
    if (!('serviceWorker' in navigator)) {
      setServiceWorkerRuntimeState('unsupported');
      return;
    }

    const validRegistration = registrationHasRootWorker(registration) ? registration : null;
    if (!validRegistration) {
      if (rootControllerIsActive()) setServiceWorkerRuntimeState('active');
      else if (swRuntimeState.phase !== 'error') setServiceWorkerRuntimeState('initializing');
      return;
    }

    if (validRegistration.waiting || (validRegistration.installing && validRegistration.active)) {
      setServiceWorkerRuntimeState('updating');
    } else if (rootControllerIsActive() && validRegistration.active) {
      setServiceWorkerRuntimeState('active');
    } else if (validRegistration.active) {
      setServiceWorkerRuntimeState('registered');
    } else if (validRegistration.installing) {
      setServiceWorkerRuntimeState('initializing');
    } else if (rootControllerIsActive()) {
      setServiceWorkerRuntimeState('active');
    } else {
      setServiceWorkerRuntimeState('initializing');
    }
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function announceServiceWorkerUpdateDetected(worker) {
    if (!worker || announcedSwUpdateWorkers.has(worker)) return;
    announcedSwUpdateWorkers.add(worker);
    showToast('Nueva versión detectada. Aplicando actualización…');
  }

  function waitForWorkerOutcome(worker, timeoutMs = 15000) {
    if (!worker) return Promise.resolve('missing');
    if (worker.state === 'activated') return Promise.resolve('activated');
    if (worker.state === 'redundant') return Promise.reject(new Error('La actualización del Service Worker quedó en estado redundant.'));

    return new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        if (timer) window.clearTimeout(timer);
        worker.removeEventListener('statechange', onStateChange);
      };
      const onStateChange = () => {
        if (worker.state === 'installed') {
          try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (error) {}
        }
        if (worker.state === 'activated') { cleanup(); resolve('activated'); }
        else if (worker.state === 'redundant') { cleanup(); reject(new Error('La actualización del Service Worker quedó en estado redundant.')); }
      };
      worker.addEventListener('statechange', onStateChange);
      timer = window.setTimeout(() => { cleanup(); resolve(worker.state || 'pending'); }, timeoutMs);
    });
  }

  async function checkRegistrationForUpdate(registration) {
    if (!registrationHasRootWorker(registration)) throw new Error('No existe un registro válido del Service Worker raíz para comprobar.');
    setServiceWorkerRuntimeState('updating');

    const alreadyPending = navigator.serviceWorker.controller ? (registration.waiting || registration.installing) : null;
    if (alreadyPending) {
      observeServiceWorkerWorker(alreadyPending);
      announceServiceWorkerUpdateDetected(alreadyPending);
      if (registration.waiting === alreadyPending) alreadyPending.postMessage({ type: 'SKIP_WAITING' });
      const outcome = await waitForWorkerOutcome(alreadyPending);
      return { updated: true, worker: alreadyPending, outcome };
    }

    let foundWorker = null;
    let resolveUpdateFound = null;
    const updateFoundPromise = new Promise((resolve) => { resolveUpdateFound = resolve; });
    const onUpdateFound = () => {
      const worker = registration.installing || registration.waiting;
      if (!worker || foundWorker) return;
      foundWorker = worker;
      observeServiceWorkerWorker(worker);
      announceServiceWorkerUpdateDetected(worker);
      resolveUpdateFound(worker);
    };

    registration.addEventListener('updatefound', onUpdateFound);
    try {
      await registration.update();
      if (!foundWorker) {
        const candidate = registration.installing || registration.waiting;
        if (candidate) onUpdateFound();
      }
      if (!foundWorker) {
        foundWorker = await Promise.race([updateFoundPromise, delay(700).then(() => null)]);
      }
      if (!foundWorker) return { updated: false, worker: null, outcome: 'current' };

      if (registration.waiting === foundWorker) foundWorker.postMessage({ type: 'SKIP_WAITING' });
      const outcome = await waitForWorkerOutcome(foundWorker);
      return { updated: true, worker: foundWorker, outcome };
    } finally {
      registration.removeEventListener('updatefound', onUpdateFound);
    }
  }

  function observeServiceWorkerWorker(worker) {
    if (!worker || observedSwWorkers.has(worker)) return;
    observedSwWorkers.add(worker);
    worker.addEventListener('statechange', () => {
      syncServiceWorkerState(swRegistration);
      if (worker.state === 'installed' && rootControllerIsActive()) announceServiceWorkerUpdateDetected(worker);
      if (worker.state === 'redundant' && !swRegistration?.active && !rootControllerIsActive()) {
        const error = new Error('El Service Worker quedó en estado redundant.');
        console.error('[DOREN] Error de Service Worker.', error);
        setServiceWorkerRuntimeState('error', error);
      }
    });
  }

  function observeServiceWorkerRegistration(registration) {
    if (!registration || !registrationHasRootWorker(registration)) return;
    swRegistration = registration;
    syncServiceWorkerState(registration);
    [registration.installing, registration.waiting, registration.active].forEach(observeServiceWorkerWorker);
    if (observedSwRegistrations.has(registration)) return;
    observedSwRegistrations.add(registration);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      observeServiceWorkerWorker(worker);
      if (worker && rootControllerIsActive()) announceServiceWorkerUpdateDetected(worker);
      syncServiceWorkerState(registration);
    });
  }

  async function waitForServiceWorkerReady(timeoutMs = 2500) {
    if (!('serviceWorker' in navigator)) return null;
    let timer = null;
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => { timer = window.setTimeout(() => resolve(null), timeoutMs); })
      ]);
      return registrationHasRootWorker(registration) ? registration : null;
    } catch (error) {
      console.warn('[DOREN] Service Worker ready no pudo confirmarse todavía.', error);
      return null;
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  async function findExistingServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) return null;
    let registration = null;

    try {
      registration = await navigator.serviceWorker.getRegistration(SW_SCOPE_URL);
      if (registrationHasRootWorker(registration)) return registration;
    } catch (error) {
      console.warn('[DOREN] getRegistration() no pudo confirmar el Service Worker raíz.', error);
    }

    if (typeof navigator.serviceWorker.getRegistrations === 'function') {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        registration = registrations.find((candidate) => registrationHasRootWorker(candidate));
        if (registration) return registration;
      } catch (error) {
        console.warn('[DOREN] getRegistrations() no pudo confirmar el Service Worker raíz.', error);
      }
    }
    return null;
  }

  async function migrateLegacyServiceWorkerRegistrations() {
    if (!('serviceWorker' in navigator) || !navigator.onLine) return 0;
    const registrations = new Set();

    try {
      const legacyScopeRegistration = await navigator.serviceWorker.getRegistration(new URL('pwa/', document.baseURI).href);
      if (legacyScopeRegistration) registrations.add(legacyScopeRegistration);
    } catch (error) {
      console.warn('[DOREN] No se pudo consultar el registro PWA anterior por scope.', error);
    }

    try {
      const rootScopeRegistration = await navigator.serviceWorker.getRegistration(SW_SCOPE_URL);
      if (rootScopeRegistration) registrations.add(rootScopeRegistration);
    } catch (error) {
      console.warn('[DOREN] No se pudo consultar el registro anterior en scope raíz.', error);
    }

    if (typeof navigator.serviceWorker.getRegistrations === 'function') {
      try {
        const existing = await navigator.serviceWorker.getRegistrations();
        existing.forEach((registration) => registrations.add(registration));
      } catch (error) {
        console.warn('[DOREN] No se pudo enumerar los registros anteriores del Service Worker.', error);
      }
    }

    let removed = 0;
    for (const registration of registrations) {
      if (!registrationHasLegacyWorker(registration) || registrationHasRootWorker(registration)) continue;
      try {
        const unregistered = await registration.unregister();
        if (unregistered) removed += 1;
        if (swRegistration === registration) swRegistration = null;
      } catch (error) {
        console.warn('[DOREN] No se pudo desregistrar un Service Worker anterior.', error);
      }
    }
    return removed;
  }

  function maybeReloadAfterLegacyControllerMigration(registration) {
    if (!legacyControllerIsActive() || !registrationHasRootWorker(registration)) return;
    try {
      if (sessionStorage.getItem(SW_ROOT_MIGRATION_RELOAD_KEY)) return;
      sessionStorage.setItem(SW_ROOT_MIGRATION_RELOAD_KEY, String(Date.now()));
      window.setTimeout(() => window.location.reload(), 180);
    } catch (error) {
      console.warn('[DOREN] No se pudo preparar la recarga única de migración PWA.', error);
    }
  }

  function clearRootMigrationReloadGuardIfReady() {
    if (!rootControllerIsActive()) return;
    try { sessionStorage.removeItem(SW_ROOT_MIGRATION_RELOAD_KEY); }
    catch (error) {}
  }

  async function resolveServiceWorkerRegistration({ allowRegister = true, waitForReady = true } = {}) {
    if (!('serviceWorker' in navigator) || !['http:', 'https:'].includes(location.protocol)) {
      setServiceWorkerRuntimeState('unsupported');
      return null;
    }

    if (registrationHasRootWorker(swRegistration)) {
      observeServiceWorkerRegistration(swRegistration);
      return swRegistration;
    }
    swRegistration = null;

    if (rootControllerIsActive()) setServiceWorkerRuntimeState('active');
    else setServiceWorkerRuntimeState('initializing');

    let registration = await findExistingServiceWorkerRegistration();
    if (registration) {
      observeServiceWorkerRegistration(registration);
      clearRootMigrationReloadGuardIfReady();
      return registration;
    }

    if (waitForReady) {
      registration = await waitForServiceWorkerReady();
      if (registration) {
        observeServiceWorkerRegistration(registration);
        clearRootMigrationReloadGuardIfReady();
        return registration;
      }
    }

    if (!allowRegister || !navigator.onLine) {
      syncServiceWorkerState(swRegistration);
      return null;
    }

    await migrateLegacyServiceWorkerRegistrations();
    registration = await findExistingServiceWorkerRegistration();
    if (registration) {
      observeServiceWorkerRegistration(registration);
      return registration;
    }

    setServiceWorkerRuntimeState('initializing');
    registration = await navigator.serviceWorker.register('service-worker.js', { scope: './', updateViaCache: 'none' });
    if (!registration) return null;
    observeServiceWorkerRegistration(registration);

    if (waitForReady && !rootControllerIsActive()) {
      const readyRegistration = await waitForServiceWorkerReady();
      if (readyRegistration) observeServiceWorkerRegistration(readyRegistration);
    }

    const confirmed = await findExistingServiceWorkerRegistration();
    if (confirmed) observeServiceWorkerRegistration(confirmed);
    const resolved = confirmed || swRegistration || registration;
    maybeReloadAfterLegacyControllerMigration(resolved);
    return resolved;
  }

  async function ensureServiceWorkerRegistration(options = {}) {
    if (registrationHasRootWorker(swRegistration)) {
      observeServiceWorkerRegistration(swRegistration);
      return swRegistration;
    }
    if (swRegistrationPromise) return swRegistrationPromise;
    swRegistrationPromise = resolveServiceWorkerRegistration(options)
      .catch(async (error) => {
        console.error('[DOREN] No se pudo registrar o recuperar el Service Worker raíz.', error);

        const recovered = await findExistingServiceWorkerRegistration();
        if (recovered) {
          observeServiceWorkerRegistration(recovered);
          return recovered;
        }
        if (rootControllerIsActive()) {
          const readyRegistration = await waitForServiceWorkerReady(4000);
          if (readyRegistration) {
            observeServiceWorkerRegistration(readyRegistration);
            return readyRegistration;
          }
          setServiceWorkerRuntimeState('active');
          return swRegistration;
        }
        setServiceWorkerRuntimeState('error', error);
        return null;
      })
      .finally(() => { swRegistrationPromise = null; });
    return swRegistrationPromise;
  }

  function markPendingPwaAppliedNotice() {
    try { sessionStorage.setItem(SW_UPDATE_APPLIED_SESSION_KEY, String(Date.now())); }
    catch (error) { console.warn('[DOREN] No se pudo guardar el estado temporal de actualización.', error); }
  }

  function consumePendingPwaAppliedNotice() {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    try {
      if (!sessionStorage.getItem(SW_UPDATE_APPLIED_SESSION_KEY)) return;
      sessionStorage.removeItem(SW_UPDATE_APPLIED_SESSION_KEY);
      showToast('Actualización aplicada.');
    } catch (error) {
      console.warn('[DOREN] No se pudo leer el estado temporal de actualización.', error);
    }
  }

  function consumePendingDangerDeleteNotice() {
    try {
      const raw = sessionStorage.getItem(DANGER_DELETE_COMPLETED_SESSION_KEY);
      if (!raw) return;
      sessionStorage.removeItem(DANGER_DELETE_COMPLETED_SESSION_KEY);
      const state = store.readRaw();
      if (!state || !operationalCollectionsAreEmpty(state)) {
        console.error('[PROMETEO] El aviso posterior al borrado no se mostró porque localStorage ya no está vacío.');
        showToast('El borrado terminó, pero la verificación posterior a la recarga detectó datos operativos inesperados.', 'error');
        return;
      }
      photoStore.count().then((remainingPhotos) => {
        if (remainingPhotos !== 0) {
          console.error(`[PROMETEO] Verificación posterior a recarga: productPhotos contiene ${remainingPhotos} elemento(s).`);
          showToast('La verificación posterior detectó fotografías residuales. Revisa la consola.', 'error');
          return;
        }
        showToast('Borrado operativo completo: datos y fotografías eliminados. Identidad del negocio conservada.');
      }).catch((error) => {
        console.error('[PROMETEO] No se pudo verificar IndexedDB después de la recarga.', error);
        showToast('No se pudo confirmar IndexedDB después de la recarga. Revisa la consola.', 'error');
      });
    } catch (error) {
      console.warn('[PROMETEO] No se pudo consumir el aviso temporal del borrado seguro.', error);
    }
  }

  async function registerServiceWorker() {
    const registration = await ensureServiceWorkerRegistration({ allowRegister: true, waitForReady: true });
    syncServiceWorkerState(registration);
    consumePendingPwaAppliedNotice();
  }

  function wirePwaEvents() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      if (safeRoute() === 'configuracion') renderRoute();
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      showToast(`${getBusinessIdentity().appName} instalada correctamente.`);
      if (safeRoute() === 'configuracion') renderRoute();
    });
    window.addEventListener('online', () => {
      refreshPwaStatusUi();
      ensureServiceWorkerRegistration({ allowRegister: true, waitForReady: true }).catch(() => {});
    });
    window.addEventListener('offline', () => {
      refreshPwaStatusUi();
      syncServiceWorkerState(swRegistration);
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        syncServiceWorkerState(swRegistration);
        clearRootMigrationReloadGuardIfReady();
        if (!hasSeenServiceWorkerController) {
          hasSeenServiceWorkerController = true;
          return;
        }
        if (reloadingForServiceWorker) return;
        reloadingForServiceWorker = true;
        markPendingPwaAppliedNotice();
        window.setTimeout(() => window.location.reload(), 120);
      });
    }
  }

  function wireEvents() {
    els.menuButton.addEventListener('click', () => {
      els.sidebar.classList.contains('is-open') ? closeMenu() : openMenu();
    });
    els.scrim.addEventListener('click', closeMenu);
    els.content.addEventListener('click', handleContentClick);
    els.content.addEventListener('input', handleContentInput);
    els.content.addEventListener('change', handleContentChange);
    els.content.addEventListener('focusin', (event) => autoSelectNumericInput(event.target));
    els.content.addEventListener('focusout', (event) => normalizeNumericInput(event.target));
    window.addEventListener('hashchange', renderRoute);
    window.addEventListener('resize', () => { if (window.innerWidth > 920) closeMenu(); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (document.body.classList.contains('modal-open')) closeModal();
        else closeMenu();
      }
    });
  }

  function init() {
    renderNavigation();
    syncGlobalIdentityShell();
    els.footerVersion.textContent = APP.version;
    wireEvents();
    wirePwaEvents();
    if (!location.hash) history.replaceState(null, '', '#inicio');
    renderRoute();
    consumePendingDangerDeleteNotice();
    registerServiceWorker();
  }

  init();
})();
