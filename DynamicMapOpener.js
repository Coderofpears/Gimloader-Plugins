/**
 * @name DynamicMapOpener
 * @description Press "=" or "+" to open a menu showing all your created maps, then click one to open it even if you can't.
 * @version 1.0
 * @author Coderofpears
 */

(function() {
    // 🚫 Do not run on join or host pages
    if (location.pathname.startsWith("/join") || location.pathname.startsWith("/host")) {
        console.log("DynamicMapCloner: Disabled on this page.");
        return;
    }

    const API_URL = "https://www.gimkit.com/api/created-maps";

    // === Utility: Create the popup menu ===
    function createPopup() {
        const oldPopup = document.getElementById("gimloader-map-popup");
        if (oldPopup) oldPopup.remove();

        const popup = document.createElement("div");
        popup.id = "gimloader-map-popup";
        Object.assign(popup.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "#1e1e2f",
            color: "#fff",
            padding: "15px",
            borderRadius: "12px",
            boxShadow: "0 0 20px rgba(0,0,0,0.3)",
            zIndex: "9999",
            maxHeight: "400px",
            overflowY: "auto",
            minWidth: "320px",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px"
        });

        const title = document.createElement("h3");
        title.innerText = "Select a Map to open";
        Object.assign(title.style, {
            marginBottom: "10px",
            textAlign: "center",
            fontWeight: "bold",
            color: "#00e1ff"
        });
        popup.appendChild(title);

        const closeBtn = document.createElement("button");
        closeBtn.innerText = "×";
        Object.assign(closeBtn.style, {
            position: "absolute",
            top: "8px",
            right: "12px",
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: "20px",
            cursor: "pointer"
        });
        closeBtn.onclick = () => popup.remove();
        popup.appendChild(closeBtn);

        const list = document.createElement("div");
        list.id = "gimloader-map-list";
        popup.appendChild(list);

        document.body.appendChild(popup);
        return list;
    }

    // === Fetch maps from Gimkit ===
    async function fetchMaps() {
        try {
            const res = await fetch(API_URL, {
                method: "GET",
                mode: "cors",
                credentials: "include",
                headers: {
                    "accept": "application/json, text/plain, */*"
                }
            });

            if (!res.ok) throw new Error("Failed to fetch maps");
            return res.json();
        } catch (err) {
            console.error("❌ Error fetching maps:", err);
            alert("Couldn't fetch maps. Are you logged in?");
            return [];
        }
    }

    // === Clone selected map ===
    async function cloneMap(mapId) {
        try {
            const res = await fetch("https://www.gimkit.com/api/matchmaker/intent/map/edit/create", {
                method: "POST",
                mode: "cors",
                credentials: "include",
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "content-type": "application/json",
                },
                referrer: "https://www.gimkit.com/creative",
                referrerPolicy: "strict-origin-when-cross-origin",
                body: JSON.stringify({ mapId }),
            });

            const text = await res.text();
            let intentId;

            try {
                const data = JSON.parse(text);
                intentId = data.intent?.id || data.id || data.intentId;
            } catch {
                intentId = text.trim();
            }

            if (!intentId) {
                console.error("⚠️ Failed to find intent ID! Response:", text);
                alert("Failed to clone map. Gimkit API returned unexpected data.");
                return;
            }

            const editUrl = `https://www.gimkit.com/host?id=${intentId}`;
            console.log("✅ Map cloned successfully! Opening editor:", editUrl);
            window.open(editUrl, "_blank");
        } catch (err) {
            console.error("❌ Error creating map:", err);
            alert("Couldn't clone the map. Are you logged in?");
        }
    }

    // === Open the map menu ===
    async function openMapMenu() {
        const list = createPopup();
        list.innerHTML = `<p style="text-align:center;color:#aaa;">Loading your maps...</p>`;

        const maps = await fetchMaps();
        list.innerHTML = "";

        if (!maps || maps.length === 0) {
            list.innerHTML = `<p style="text-align:center;color:#ff6b6b;">No maps found!</p>`;
            return;
        }

        maps.forEach((map) => {
            const btn = document.createElement("button");
            btn.innerText = map.name || "Untitled Map";
            Object.assign(btn.style, {
                display: "block",
                width: "100%",
                padding: "8px",
                margin: "4px 0",
                backgroundColor: "#2a2a3d",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.2s"
            });
            btn.onmouseover = () => (btn.style.backgroundColor = "#3b3b5c");
            btn.onmouseleave = () => (btn.style.backgroundColor = "#2a2a3d");
            btn.onclick = () => {
                document.getElementById("gimloader-map-popup")?.remove();
                cloneMap(map._id);
            };
            list.appendChild(btn);
        });
    }

    // === Key listener: Press "=" or "+" ===
    document.addEventListener("keydown", (e) => {
        if (e.key === "=" || e.key === "+") {
            e.preventDefault();
            openMapMenu();
        }
    });

})();
