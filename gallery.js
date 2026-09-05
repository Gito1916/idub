(function () {
  const CONFIG = {
    cloudName: 'dbfdbzxxv',
    uploadPreset: 'iu_divineconnect_gallery',
    galleryTag: 'IU-DivineConnect',
    uploadFolder: 'iu-divineconnect/gallery',
    maxUploadsPerBrowser: 15,
    autoRefreshMs: 20000,
    quickSyncDelayMs: 8000,
    sharedFeedDelayMs: 65000
  };

  const STORAGE_KEYS = {
    uploadCount: 'iuDivineConnectGalleryUploadCount',
    uploaderName: 'iuDivineConnectGalleryUploaderName',
    recentUploads: 'iuDivineConnectGalleryRecentUploads'
  };

  const EVENT_OPTIONS = {
    'traditional-marriage': 'Traditional Marriage',
    'marriage-blessing': 'Marriage Blessing',
    reception: 'Reception'
  };

  const PLACEHOLDER_VALUES = new Set([
    'YOUR_CLOUDINARY_CLOUD_NAME',
    'YOUR_UNSIGNED_UPLOAD_PRESET'
  ]);

  const state = {
    photos: [],
    visiblePhotos: [],
    uploadWidget: null,
    currentUploader: '',
    currentEvent: '',
    handledUploads: new Set(),
    galleryRefreshTimer: null,
    pendingSyncTimeouts: [],
    isLoadingGallery: false,
    lightboxIndex: -1,
    touchStartX: 0,
    touchEndX: 0
  };

  const elements = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    hydrateUploaderName();

    updateUploadTexts();

    if (!window.cloudinary) {
      showSetup(
        'The Cloudinary upload widget did not load. Open the live site and make sure the Cloudinary script is allowed to load.'
      );
      setStatus('Cloudinary could not be loaded for this page.', true);
      renderGallery();
      return;
    }

    if (!isConfigured()) {
      showSetup(
        'Add your Cloudinary cloud name and unsigned upload preset in gallery.js, then refresh this page.'
      );
      setStatus('Finish the Cloudinary setup in gallery.js to turn the gallery on.', true);
      renderGallery();
      return;
    }

    loadGallery();
    startAutoRefresh();
  }

  function cacheElements() {
    elements.gallerySetup = document.getElementById('gallerySetup');
    elements.openUploadBtn = document.getElementById('openUploadBtn');
    elements.refreshGalleryBtn = document.getElementById('refreshGalleryBtn');
    elements.searchInput = document.getElementById('searchInput');
    elements.eventFilter = document.getElementById('eventFilter');
    elements.galleryGrid = document.getElementById('galleryGrid');
    elements.galleryCount = document.getElementById('galleryCount');
    elements.galleryStatus = document.getElementById('galleryStatus');
    elements.uploadLimitText = document.getElementById('uploadLimitText');
    elements.uploadModal = document.getElementById('uploadModal');
    elements.uploadModalBackdrop = document.getElementById('uploadModalBackdrop');
    elements.closeUploadModal = document.getElementById('closeUploadModal');
    elements.cancelUploadBtn = document.getElementById('cancelUploadBtn');
    elements.uploadDetailsForm = document.getElementById('uploadDetailsForm');
    elements.uploaderName = document.getElementById('uploaderName');
    elements.uploadEvent = document.getElementById('uploadEvent');
    elements.uploadFormNote = document.getElementById('uploadFormNote');
    elements.lightbox = document.getElementById('lightbox');
    elements.lightboxBackdrop = document.getElementById('lightboxBackdrop');
    elements.lightboxImage = document.getElementById('lightboxImage');
    elements.lightboxTitle = document.getElementById('lightboxTitle');
    elements.lightboxSubtitle = document.getElementById('lightboxSubtitle');
    elements.lightboxDownload = document.getElementById('lightboxDownload');
    elements.closeLightbox = document.getElementById('closeLightbox');
    elements.prevPhotoBtn = document.getElementById('prevPhotoBtn');
    elements.nextPhotoBtn = document.getElementById('nextPhotoBtn');
    elements.lightboxFrame = document.getElementById('lightboxFrame');
  }

  function bindEvents() {
    elements.openUploadBtn.addEventListener('click', handleOpenUpload);
    elements.refreshGalleryBtn.addEventListener('click', () => loadGallery(true));
    elements.searchInput.addEventListener('input', renderGallery);
    elements.eventFilter.addEventListener('change', renderGallery);
    elements.uploadDetailsForm.addEventListener('submit', handleUploadDetailsSubmit);
    elements.closeUploadModal.addEventListener('click', closeUploadModal);
    elements.cancelUploadBtn.addEventListener('click', closeUploadModal);
    elements.uploadModalBackdrop.addEventListener('click', closeUploadModal);
    elements.lightboxBackdrop.addEventListener('click', closeLightbox);
    elements.closeLightbox.addEventListener('click', closeLightbox);
    elements.prevPhotoBtn.addEventListener('click', () => navigateLightbox(-1));
    elements.nextPhotoBtn.addEventListener('click', () => navigateLightbox(1));

    elements.lightboxFrame.addEventListener('touchstart', (event) => {
      state.touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });

    elements.lightboxFrame.addEventListener('touchend', (event) => {
      state.touchEndX = event.changedTouches[0].clientX;
      handleSwipeGesture();
    }, { passive: true });

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', stopAutoRefresh);
  }

  function handleKeydown(event) {
    if (!elements.lightbox.hidden) {
      if (event.key === 'Escape') {
        closeLightbox();
        return;
      }

      if (event.key === 'ArrowLeft') {
        navigateLightbox(-1);
        return;
      }

      if (event.key === 'ArrowRight') {
        navigateLightbox(1);
        return;
      }
    }

    if (event.key === 'Escape' && !elements.uploadModal.hidden) {
      closeUploadModal();
    }
  }

  function isConfigured() {
    return !PLACEHOLDER_VALUES.has(CONFIG.cloudName) && !PLACEHOLDER_VALUES.has(CONFIG.uploadPreset);
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopAutoRefresh();
      return;
    }

    startAutoRefresh();
    loadGallery(false, true);
  }

  function startAutoRefresh() {
    if (state.galleryRefreshTimer || !isConfigured()) {
      return;
    }

    state.galleryRefreshTimer = window.setInterval(() => {
      loadGallery(false, true);
    }, CONFIG.autoRefreshMs);
  }

  function stopAutoRefresh() {
    if (!state.galleryRefreshTimer) {
      return;
    }

    window.clearInterval(state.galleryRefreshTimer);
    state.galleryRefreshTimer = null;
  }

  function queueSharedFeedSync(delayMs) {
    const timeoutId = window.setTimeout(() => {
      state.pendingSyncTimeouts = state.pendingSyncTimeouts.filter((id) => id !== timeoutId);
      loadGallery(false, true);
    }, delayMs);

    state.pendingSyncTimeouts.push(timeoutId);
  }

  function schedulePostUploadSync() {
    state.pendingSyncTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    state.pendingSyncTimeouts = [];
    queueSharedFeedSync(CONFIG.quickSyncDelayMs);
    queueSharedFeedSync(CONFIG.sharedFeedDelayMs);
  }

  async function loadGallery(isManualRefresh, isBackgroundRefresh) {
    if (!isConfigured()) {
      renderGallery();
      return;
    }

    if (state.isLoadingGallery) {
      return;
    }

    state.isLoadingGallery = true;

    if (isManualRefresh) {
      elements.refreshGalleryBtn.classList.add('is-refreshing');
    }

    if (!isBackgroundRefresh) {
      setStatus(isManualRefresh ? 'Refreshing photos...' : 'Loading shared photos...');
    }

    try {
      const response = await fetch(getGalleryListUrl(Date.now()), { cache: 'no-store' });

      if (response.status === 404) {
        state.photos = mergePhotos([], loadRecentUploads());
        hideSetup();
        if (!isBackgroundRefresh) {
          setStatus('No uploads yet. The first guest photo will appear here.');
        }
        renderGallery();
        return;
      }

      if (!response.ok) {
        throw new Error('gallery-list-unavailable');
      }

      const payload = await response.json();
      const resources = Array.isArray(payload.resources) ? payload.resources : [];
      const remotePhotos = resources.map(buildPhotoFromResource);

      state.photos = mergePhotos(remotePhotos, loadRecentUploads());
      hideSetup();
      if (!isBackgroundRefresh) {
        setStatus(state.photos.length ? 'Shared gallery is ready.' : 'No uploads yet. The first guest photo will appear here.');
      }
      renderGallery();
    } catch (error) {
      state.photos = mergePhotos([], loadRecentUploads());
      showSetup(
        'If uploads are working but photos do not appear here, allow the Resource List delivery type in Cloudinary security settings.'
      );
      if (!isBackgroundRefresh) {
        setStatus(
          'Photos could not be loaded from Cloudinary yet. Check the Resource List setting for this cloud.',
          true
        );
      }
      renderGallery();
    } finally {
      state.isLoadingGallery = false;

      if (isManualRefresh) {
        elements.refreshGalleryBtn.classList.remove('is-refreshing');
      }
    }
  }

  function handleOpenUpload() {
    if (!window.cloudinary || !isConfigured()) {
      showSetup(
        'Uploads need a working Cloudinary cloud name and unsigned upload preset in gallery.js before they can work.'
      );
      setStatus('Finish the Cloudinary setup before opening uploads.', true);
      return;
    }

    if (getRemainingUploads() <= 0) {
      setStatus(`This browser has reached its ${CONFIG.maxUploadsPerBrowser}-photo upload limit for the gallery.`, true);
      return;
    }

    hydrateUploaderName();
    openUploadModal();
  }

  function handleUploadDetailsSubmit(event) {
    event.preventDefault();

    const uploaderName = cleanName(elements.uploaderName.value);
    const eventValue = elements.uploadEvent.value;

    if (!uploaderName || !eventValue) {
      setStatus('Please enter your name and choose the event before uploading.', true);
      return;
    }

    state.currentUploader = uploaderName;
    state.currentEvent = eventValue;

    localStorage.setItem(STORAGE_KEYS.uploaderName, uploaderName);
    closeUploadModal();
    openUploadWidget();
  }

  function openUploadWidget() {
    const widget = getUploadWidget();
    setStatus('Opening upload window...');
    widget.open();
  }

  function getUploadWidget() {
    if (state.uploadWidget) {
      return state.uploadWidget;
    }

    state.uploadWidget = window.cloudinary.createUploadWidget(
      {
        cloudName: CONFIG.cloudName,
        uploadPreset: CONFIG.uploadPreset,
        defaultSource: 'local',
        sources: ['local', 'camera'],
        language: 'en',
        secure: true,
        multiple: true,
        maxFiles: CONFIG.maxUploadsPerBrowser,
        maxImageFileSize: 12000000,
        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
        resourceType: 'image',
        showCompletedButton: true,
        singleUploadAutoClose: false,
        styles: getUploadWidgetStyles(),
        preBatch: function (cb, data) {
          const remainingUploads = getRemainingUploads();
          const files = Array.isArray(data.files) ? data.files.length : 0;

          if (!state.currentUploader || !state.currentEvent) {
            cb({ cancel: true });
            setStatus('Please enter your name and choose the event before uploading.', true);
            return;
          }

          if (remainingUploads <= 0) {
            cb({ cancel: true });
            setStatus(`This browser has reached its ${CONFIG.maxUploadsPerBrowser}-photo upload limit for the gallery.`, true);
            return;
          }

          if (files > remainingUploads) {
            cb({ cancel: true });
            setStatus(
              `You can upload ${remainingUploads} more photo${remainingUploads === 1 ? '' : 's'} from this browser.`,
              true
            );
            return;
          }

          cb();
        },
        prepareUploadParams: function (cb) {
          cb({
            folder: CONFIG.uploadFolder,
            publicId: buildUploadPublicId(state.currentUploader, state.currentEvent),
            tags: buildUploadTags(state.currentUploader, state.currentEvent),
            context: {
              uploader: state.currentUploader,
              event_type: getEventLabel(state.currentEvent),
              event_slug: state.currentEvent
            }
          });
        }
      },
      handleUploadWidgetEvent
    );

    return state.uploadWidget;
  }

  function handleUploadWidgetEvent(error, result) {
    if (error) {
      setStatus('The upload could not be completed. Please try again.', true);
      return;
    }

    if (!result || !result.event) {
      return;
    }

    if (result.event === 'success') {
      handleUploadSuccess(result.info);
      return;
    }

    if (result.event === 'queues-end') {
      const remainingUploads = getRemainingUploads();
      setStatus(
        `Upload complete. ${remainingUploads} upload slot${remainingUploads === 1 ? '' : 's'} left on this browser.`
      );
      return;
    }

    if (result.event === 'batch-cancelled' || result.event === 'abort') {
      setStatus('Upload cancelled.');
    }
  }

  function handleUploadSuccess(info) {
    const uploadKey = info.asset_id || info.public_id;

    if (!uploadKey || state.handledUploads.has(uploadKey)) {
      return;
    }

    state.handledUploads.add(uploadKey);

    const photo = buildPhotoFromUploadResult(info, state.currentUploader, state.currentEvent);

    incrementUploadCount();
    saveRecentUpload(photo);
    state.photos = mergePhotos(state.photos, [photo]);
    updateUploadTexts();
    renderGallery();
    schedulePostUploadSync();
    setStatus(`Uploaded ${photo.uploaderName}'s photo. Other browsers can take up to about 1 minute to show it.`);
  }

  function renderGallery() {
    const filteredPhotos = getFilteredPhotos();

    state.visiblePhotos = filteredPhotos;
    elements.galleryGrid.innerHTML = '';
    elements.galleryGrid.classList.remove('gallery-grid--empty');

    filteredPhotos.forEach((photo, index) => {
      elements.galleryGrid.appendChild(createPhotoTile(photo, index));
    });

    const totalPhotos = state.photos.length;
    const filteredCount = filteredPhotos.length;

    if (totalPhotos === 0) {
      showEmptyState('No photos yet');
      elements.galleryCount.textContent = '0 photos';
      return;
    }

    if (filteredCount === 0) {
      showEmptyState('No matching photos');
      elements.galleryCount.textContent = `Showing 0 of ${totalPhotos} photos`;
      return;
    }

    elements.galleryCount.textContent =
      filteredCount === totalPhotos
        ? `${totalPhotos} photo${totalPhotos === 1 ? '' : 's'}`
        : `${filteredCount} of ${totalPhotos} photos`;
  }

  function getFilteredPhotos() {
    const searchTerm = normalizeSearchText(elements.searchInput.value);
    const eventFilter = elements.eventFilter.value;

    return state.photos.filter((photo) => {
      const matchesEvent = eventFilter === 'all' || photo.eventValue === eventFilter;
      const matchesSearch = !searchTerm || normalizeSearchText(photo.uploaderName).includes(searchTerm);

      return matchesEvent && matchesSearch;
    });
  }

  function createPhotoTile(photo, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-tile';
    button.setAttribute('aria-label', `Open photo uploaded by ${photo.uploaderName}`);
    button.addEventListener('click', () => openLightbox(index));

    const image = document.createElement('img');
    image.className = 'gallery-tile__image';
    image.src = photo.thumbnailUrl;
    image.alt = `${photo.eventType} photo uploaded by ${photo.uploaderName}`;
    image.loading = 'lazy';

    const overlay = document.createElement('div');
    overlay.className = 'gallery-tile__overlay';

    const label = document.createElement('span');
    label.className = 'gallery-tile__label';
    label.textContent = photo.uploaderName;

    overlay.appendChild(label);
    button.append(image, overlay);

    return button;
  }

  function openLightbox(index) {
    if (!state.visiblePhotos.length) {
      return;
    }

    state.lightboxIndex = index;
    updateLightbox();
    elements.lightbox.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeLightbox() {
    elements.lightbox.hidden = true;
    document.body.classList.remove('modal-open');
    state.lightboxIndex = -1;
  }

  function navigateLightbox(direction) {
    if (!state.visiblePhotos.length) {
      return;
    }

    const total = state.visiblePhotos.length;
    state.lightboxIndex = (state.lightboxIndex + direction + total) % total;
    updateLightbox();
  }

  function updateLightbox() {
    const photo = state.visiblePhotos[state.lightboxIndex];

    if (!photo) {
      return;
    }

    elements.lightboxImage.src = photo.fullUrl;
    elements.lightboxImage.alt = `${photo.eventType} photo uploaded by ${photo.uploaderName}`;
    elements.lightboxDownload.href = photo.downloadUrl;
    elements.lightboxTitle.textContent = `${photo.uploaderName} - ${photo.eventType}`;
    elements.lightboxSubtitle.textContent =
      `${state.lightboxIndex + 1} of ${state.visiblePhotos.length} - Swipe left or right to view others.`;

    const showNav = state.visiblePhotos.length > 1;
    elements.prevPhotoBtn.hidden = !showNav;
    elements.nextPhotoBtn.hidden = !showNav;
  }

  function handleSwipeGesture() {
    const deltaX = state.touchEndX - state.touchStartX;

    if (Math.abs(deltaX) < 40) {
      return;
    }

    navigateLightbox(deltaX < 0 ? 1 : -1);
  }

  function showEmptyState(message) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'gallery-grid__empty';
    emptyMessage.textContent = message;

    elements.galleryGrid.innerHTML = '';
    elements.galleryGrid.classList.add('gallery-grid--empty');
    elements.galleryGrid.appendChild(emptyMessage);
  }

  function openUploadModal() {
    elements.uploadModal.hidden = false;
    document.body.classList.add('modal-open');
    window.setTimeout(() => {
      elements.uploaderName.focus();
      elements.uploaderName.select();
    }, 50);
  }

  function closeUploadModal() {
    elements.uploadModal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function updateUploadTexts() {
    const remainingUploads = getRemainingUploads();
    const usedUploads = getStoredUploadCount();
    const syncNote = 'Shared uploads may take about 1 minute to appear on other browsers.';

    elements.uploadLimitText.textContent =
      remainingUploads > 0
        ? `This browser has used ${usedUploads} of ${CONFIG.maxUploadsPerBrowser} upload slots. ${syncNote}`
        : `This browser has used all ${CONFIG.maxUploadsPerBrowser} upload slots for the gallery. ${syncNote}`;

    elements.uploadFormNote.textContent =
      remainingUploads > 0
        ? `This browser can still upload ${remainingUploads} photo${remainingUploads === 1 ? '' : 's'} to the gallery. ${syncNote}`
        : `This browser has reached its ${CONFIG.maxUploadsPerBrowser}-photo upload limit for the gallery. ${syncNote}`;

    elements.openUploadBtn.disabled = remainingUploads <= 0 || !window.cloudinary || !isConfigured();
  }

  function getUploadWidgetStyles() {
    return {
      palette: {
        window: '#fffdfb',
        windowBorder: '#dcc8a3',
        tabIcon: '#132949',
        menuIcons: '#631f33',
        textDark: '#0a1830',
        textLight: '#fffdfb',
        link: '#631f33',
        action: '#132949',
        inactiveTabIcon: '#8d7d6f',
        error: '#631f33',
        inProgress: '#cca45d',
        complete: '#132949',
        sourceBg: '#f8f2ea'
      },
      fonts: {
        default: {
          active: true
        },
        "'Cormorant Garamond', serif": {
          url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap',
          active: true
        }
      }
    };
  }

  function setStatus(message, isError) {
    elements.galleryStatus.textContent = message;
    elements.galleryStatus.classList.remove('visually-hidden');
    elements.galleryStatus.classList.toggle('is-error', Boolean(isError));
  }

  function showSetup(message) {
    const paragraph = elements.gallerySetup.querySelector('p');
    paragraph.textContent = message;
    elements.gallerySetup.hidden = false;
  }

  function hideSetup() {
    elements.gallerySetup.hidden = true;
  }

  function hydrateUploaderName() {
    const storedName = localStorage.getItem(STORAGE_KEYS.uploaderName);

    if (storedName) {
      elements.uploaderName.value = storedName;
    }
  }

  function getGalleryListUrl(cacheKey) {
    const baseUrl =
      `https://res.cloudinary.com/${CONFIG.cloudName}/image/list/${encodeURIComponent(CONFIG.galleryTag)}.json`;

    return cacheKey ? `${baseUrl}?_=${encodeURIComponent(cacheKey)}` : baseUrl;
  }

  function buildPhotoFromResource(resource) {
    const customContext = getCustomContext(resource.context);
    const derivedIdentity = parsePublicIdMetadata(resource.public_id);
    const uploaderName =
      customContext.uploader ||
      unslugify(extractPrefixedTag(resource.tags, 'uploader-')) ||
      derivedIdentity.uploaderName ||
      'Guest';
    const eventValue =
      normalizeEventValue(customContext.event_slug) ||
      normalizeEventValue(customContext.event_type) ||
      normalizeEventValue(extractPrefixedTag(resource.tags, 'event-')) ||
      derivedIdentity.eventValue ||
      'traditional-marriage';

    return buildPhotoObject({
      publicId: resource.public_id,
      assetId: resource.asset_id || resource.public_id,
      version: resource.version,
      format: resource.format || 'jpg',
      uploaderName: uploaderName,
      eventValue: eventValue,
      secureUrl: resource.secure_url,
      createdAt: resource.created_at,
      tags: Array.isArray(resource.tags) ? resource.tags : []
    });
  }

  function buildPhotoFromUploadResult(info, uploaderName, eventValue) {
    return buildPhotoObject({
      publicId: info.public_id,
      assetId: info.asset_id || info.public_id,
      version: info.version,
      format: info.format || 'jpg',
      uploaderName: uploaderName,
      eventValue: eventValue,
      secureUrl: info.secure_url,
      createdAt: info.created_at || new Date().toISOString(),
      tags: buildUploadTags(uploaderName, eventValue)
    });
  }

  function buildPhotoObject(data) {
    const eventLabel = getEventLabel(data.eventValue);
    const versionPath = data.version ? `v${data.version}/` : '';
    const extension = data.format ? `.${data.format}` : '';
    const baseImagePath = `https://res.cloudinary.com/${CONFIG.cloudName}/image/upload/`;
    const encodedDownloadName = encodeURIComponent(
      `iu-divineconnect-${data.eventValue}-${slugify(data.uploaderName) || 'guest'}`
    );

    return {
      assetId: data.assetId,
      publicId: data.publicId,
      version: data.version,
      format: data.format,
      uploaderName: data.uploaderName,
      eventValue: data.eventValue,
      eventType: eventLabel,
      tags: data.tags,
      createdAt: data.createdAt || '',
      createdLabel: formatDate(data.createdAt),
      thumbnailUrl:
        `${baseImagePath}f_auto,q_auto,c_fill,w_360,h_360/${versionPath}${data.publicId}${extension}`,
      fullUrl:
        data.secureUrl || `${baseImagePath}f_auto,q_auto/${versionPath}${data.publicId}${extension}`,
      downloadUrl:
        `${baseImagePath}fl_attachment:${encodedDownloadName}/${versionPath}${data.publicId}${extension}`
    };
  }

  function mergePhotos(primaryPhotos, secondaryPhotos) {
    const map = new Map();
    const allPhotos = [...secondaryPhotos, ...primaryPhotos];

    allPhotos.forEach((photo) => {
      if (photo && photo.publicId) {
        map.set(photo.publicId, photo);
      }
    });

    return Array.from(map.values()).sort((left, right) => getSortTimestamp(right) - getSortTimestamp(left));
  }

  function getSortTimestamp(photo) {
    const parsedDate = Date.parse(photo.createdAt || '');

    if (!Number.isNaN(parsedDate)) {
      return parsedDate;
    }

    return Number(photo.version || 0);
  }

  function buildUploadTags(uploaderName, eventValue) {
    return [
      CONFIG.galleryTag,
      `uploader-${slugify(uploaderName)}`,
      `event-${eventValue}`
    ];
  }

  function buildUploadPublicId(uploaderName, eventValue) {
    const uploaderSlug = slugify(uploaderName) || 'guest';
    const eventSlug = normalizeEventValue(eventValue) || 'traditional-marriage';
    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    return `iu-dc__${eventSlug}__${uploaderSlug}__${uniqueSuffix}`;
  }

  function parsePublicIdMetadata(publicId) {
    const baseName = getPublicIdBaseName(publicId);
    const parts = baseName.split('__');

    if (parts.length < 4 || parts[0] !== 'iu-dc') {
      return {
        eventValue: '',
        uploaderName: ''
      };
    }

    return {
      eventValue: normalizeEventValue(parts[1]),
      uploaderName: unslugify(parts[2])
    };
  }

  function getPublicIdBaseName(publicId) {
    return String(publicId || '').split('/').pop() || '';
  }

  function getCustomContext(context) {
    if (!context || typeof context !== 'object') {
      return {};
    }

    return context.custom && typeof context.custom === 'object' ? context.custom : context;
  }

  function extractPrefixedTag(tags, prefix) {
    if (!Array.isArray(tags)) {
      return '';
    }

    const foundTag = tags.find((tag) => typeof tag === 'string' && tag.startsWith(prefix));
    return foundTag ? foundTag.slice(prefix.length) : '';
  }

  function formatDate(value) {
    if (!value) {
      return '';
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return parsedDate.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function normalizeEventValue(value) {
    if (!value) {
      return '';
    }

    const normalized = String(value).trim().toLowerCase();

    if (EVENT_OPTIONS[normalized]) {
      return normalized;
    }

    if (normalized === 'marriage blessing') {
      return 'marriage-blessing';
    }

    if (normalized === 'traditional marriage') {
      return 'traditional-marriage';
    }

    return normalized === 'reception' ? 'reception' : '';
  }

  function getEventLabel(eventValue) {
    return EVENT_OPTIONS[eventValue] || 'Traditional Marriage';
  }

  function cleanName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function slugify(value) {
    return cleanName(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function unslugify(value) {
    if (!value) {
      return '';
    }

    return value
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function getStoredUploadCount() {
    const rawValue = Number(localStorage.getItem(STORAGE_KEYS.uploadCount));
    return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
  }

  function getRemainingUploads() {
    return Math.max(CONFIG.maxUploadsPerBrowser - getStoredUploadCount(), 0);
  }

  function incrementUploadCount() {
    const nextValue = Math.min(getStoredUploadCount() + 1, CONFIG.maxUploadsPerBrowser);
    localStorage.setItem(STORAGE_KEYS.uploadCount, String(nextValue));
  }

  function loadRecentUploads() {
    try {
      const rawValue = localStorage.getItem(STORAGE_KEYS.recentUploads);
      const parsedValue = rawValue ? JSON.parse(rawValue) : [];
      const cutoff = Date.now() - (30 * 60 * 1000);

      if (!Array.isArray(parsedValue)) {
        return [];
      }

      const freshUploads = parsedValue.filter((photo) => photo && photo.createdAt && getSortTimestamp(photo) >= cutoff);
      localStorage.setItem(STORAGE_KEYS.recentUploads, JSON.stringify(freshUploads));
      return freshUploads;
    } catch (error) {
      localStorage.removeItem(STORAGE_KEYS.recentUploads);
      return [];
    }
  }

  function saveRecentUpload(photo) {
    const recentUploads = loadRecentUploads();
    const mergedUploads = mergePhotos(recentUploads, [photo]).slice(0, 40);
    localStorage.setItem(STORAGE_KEYS.recentUploads, JSON.stringify(mergedUploads));
  }
})();
