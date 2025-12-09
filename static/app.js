document.addEventListener("DOMContentLoaded", () => {
  // Elements (some may not exist)
  const uploadForm = document.getElementById("upload-form");
  const fileInput = document.getElementById("file-input");
  const uploadStatus = document.getElementById("upload-status");

  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const searchStatus = document.getElementById("search-status");

  const resultsContainer = document.getElementById("results-container");
  const paginationContainer = document.getElementById("pagination");

  // Pagination state
  const PAGE_SIZE = 6;
  let flatResults = []; // { filename, snippet }
  let currentPage = 1;

  // --- Helper: render a page of results ---
  function renderPage(page) {
    if (!resultsContainer || !paginationContainer) return;

    if (!flatResults.length) {
      resultsContainer.innerHTML = "<p class='no-results'>No hay resultados.</p>";
      paginationContainer.innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(flatResults.length / PAGE_SIZE);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentPage = page;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = flatResults.slice(start, end);

    // Clear and render results
    resultsContainer.innerHTML = "";
    pageItems.forEach((item) => {
      const fileDiv = document.createElement("div");
      fileDiv.className = "result-item";

      const title = document.createElement("h3");
      title.textContent = item.filename;

      const p = document.createElement("p");
      p.className = "snippet";
      p.innerHTML = "• " + item.snippet; // snippet already has <mark> tags

      fileDiv.appendChild(title);
      fileDiv.appendChild(p);
      resultsContainer.appendChild(fileDiv);
    });

    // Render pagination controls
    paginationContainer.innerHTML = "";

    const totalText = document.createElement("span");
    totalText.className = "pagination-info";
    totalText.textContent = `Página ${currentPage} de ${totalPages} · ${flatResults.length} resultados`;

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "Anterior";
    prevBtn.className = "page-btn";
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => renderPage(currentPage - 1));

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Siguiente";
    nextBtn.className = "page-btn";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", () => renderPage(currentPage + 1));

    paginationContainer.appendChild(prevBtn);
    paginationContainer.appendChild(totalText);
    paginationContainer.appendChild(nextBtn);
  }

  // --- Upload handler (only if the form exists) ---
  if (uploadForm && fileInput && uploadStatus) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      uploadStatus.textContent = "Subiendo archivos...";
      uploadStatus.classList.remove("error");

      const files = fileInput.files;
      if (!files || files.length === 0) {
        uploadStatus.textContent = "Por favor selecciona al menos un archivo.";
        return;
      }

      const formData = new FormData();
      for (const f of files) {
        formData.append("files", f);
      }

      try {
        const res = await fetch("/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          uploadStatus.textContent =
            err.error || "Hubo un error al subir los archivos.";
          uploadStatus.classList.add("error");
          return;
        }

        const data = await res.json();
        let msg = "Carga completada.";
        if (data.saved && data.saved.length) {
          msg += ` Guardados: ${data.saved.join(", ")}.`;
        }
        if (data.rejected && data.rejected.length) {
          msg += ` Rechazados (no pdf/docx): ${data.rejected.join(", ")}.`;
        }
        uploadStatus.textContent = msg;
        fileInput.value = "";
      } catch (err) {
        console.error(err);
        uploadStatus.textContent = "Error al subir archivos.";
        uploadStatus.classList.add("error");
      }
    });
  }

  // --- Search handler ---
  if (searchForm && searchInput && searchStatus && resultsContainer) {
    searchForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const query = searchInput.value.trim();
      if (!query) return;

      // 👇 NUEVO: leer qué PDF eligió el usuario
      const pdfChoice =
        document.querySelector('input[name="pdfChoice"]:checked')?.value || "all";

      searchStatus.textContent = `Buscando "${query}"...`;
      searchStatus.classList.remove("error");
      resultsContainer.innerHTML = "";
      if (paginationContainer) paginationContainer.innerHTML = "";

      try {
        const res = await fetch("/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            pdfChoice,   // 👈 se manda al backend
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          searchStatus.textContent =
            err.error || "Hubo un error al realizar la búsqueda.";
          searchStatus.classList.add("error");
          return;
        }

        const data = await res.json();
        const results = data.results || [];

        // Aplanar resultados: un ítem por snippet
        flatResults = [];
        results.forEach((fileResult) => {
          (fileResult.snippets || []).forEach((snippet) => {
            flatResults.push({
              filename: fileResult.filename,
              snippet: snippet,
            });
          });
        });

        if (!flatResults.length) {
          searchStatus.textContent = `No se encontraron coincidencias para "${query}".`;
          resultsContainer.innerHTML = "";
          if (paginationContainer) paginationContainer.innerHTML = "";
          return;
        }

        searchStatus.textContent = `Se encontraron ${flatResults.length} resultado(s) para "${query}".`;
        renderPage(1);
      } catch (err) {
        console.error(err);
        searchStatus.textContent = "Error al realizar la búsqueda.";
        searchStatus.classList.add("error");
      }
    });
  }
});