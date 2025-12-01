document.addEventListener("DOMContentLoaded", () => {
  // Elements (some may not exist)
  const uploadForm = document.getElementById("upload-form");
  const fileInput = document.getElementById("file-input");
  const uploadStatus = document.getElementById("upload-status");

  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const searchStatus = document.getElementById("search-status");

  const resultsContainer = document.getElementById("results-container");

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

  // --- Search handler (this is the part you need) ---
  if (searchForm && searchInput && searchStatus && resultsContainer) {
    searchForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const query = searchInput.value.trim();
      if (!query) return;

      searchStatus.textContent = `Buscando "${query}"...`;
      searchStatus.classList.remove("error");
      resultsContainer.innerHTML = "";

      try {
        const res = await fetch("/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
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

        if (results.length === 0) {
          searchStatus.textContent = `No se encontraron coincidencias para "${query}".`;
          resultsContainer.innerHTML = "";
          return;
        }

        searchStatus.textContent = `Se encontraron coincidencias para "${query}" en ${results.length} archivo(s).`;

        // Renderizar resultados
        resultsContainer.innerHTML = "";
        results.forEach((fileResult) => {
          const fileDiv = document.createElement("div");
          fileDiv.className = "result-file";

          const title = document.createElement("h3");
          title.textContent = fileResult.filename;
          fileDiv.appendChild(title);

          (fileResult.snippets || []).forEach((snippet) => {
            const p = document.createElement("p");
            p.className = "snippet";
            p.innerHTML = "• " + snippet; // snippet ya viene con <mark>
            fileDiv.appendChild(p);
          });

          resultsContainer.appendChild(fileDiv);
        });
      } catch (err) {
        console.error(err);
        searchStatus.textContent = "Error al realizar la búsqueda.";
        searchStatus.classList.add("error");
      }
    });
  }
});