/**
 * @name EasyAccountSwitcher
 * @description Switch accounts quickly and easily
 * @version 1.0
 * @author Coderofpears
 */

(function() {
    const API_LOGIN = "https://www.gimkit.com/api/login";
    const API_REGISTER_INFO = "https://www.gimkit.com/api/users/register/email-info";
    const API_LOGOUT = "https://www.gimkit.com/api/logout";
    const STORAGE_KEY = "gimkit_saved_accounts";

    // === Storage Functions ===
    function getSavedAccounts() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (err) {
            console.error("Failed to load saved accounts:", err);
            return [];
        }
    }

    function saveAccount(email, password) {
        try {
            const accounts = getSavedAccounts();
            
            // Check if account already exists
            const existingIndex = accounts.findIndex(acc => acc.email === email);
            
            if (existingIndex !== -1) {
                // Update existing account
                accounts[existingIndex] = { email, password, lastUsed: Date.now() };
            } else {
                // Add new account
                accounts.push({ email, password, lastUsed: Date.now() });
            }
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
            console.log("✅ Account saved!");
            return true;
        } catch (err) {
            console.error("Failed to save account:", err);
            return false;
        }
    }

    function deleteAccount(email) {
        try {
            let accounts = getSavedAccounts();
            accounts = accounts.filter(acc => acc.email !== email);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
            console.log("✅ Account deleted!");
            return true;
        } catch (err) {
            console.error("Failed to delete account:", err);
            return false;
        }
    }

    function updateLastUsed(email) {
        try {
            const accounts = getSavedAccounts();
            const account = accounts.find(acc => acc.email === email);
            if (account) {
                account.lastUsed = Date.now();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
            }
        } catch (err) {
            console.error("Failed to update last used:", err);
        }
    }

    // === Utility: Perform logout ===
    async function performLogout() {
        try {
            await fetch(API_LOGOUT, {
                method: "POST",
                mode: "cors",
                credentials: "include",
                headers: {
                    "accept": "application/json, text/plain, */*",
                }
            });
            return true;
        } catch (err) {
            console.error("❌ Logout error:", err);
            return false;
        }
    }

    // === Utility: Perform login ===
    async function performLogin(email, password, saveCredentials = true) {
        try {
            const res = await fetch(API_LOGIN, {
                method: "POST",
                mode: "cors",
                credentials: "include",
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    googleToken: ""
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || `Login failed: ${res.status}`);
            }

            const data = await res.json();
            
            // Save credentials if login was successful
            if (saveCredentials) {
                saveAccount(email, password);
            }
            
            updateLastUsed(email);
            
            return { success: true, data };
        } catch (err) {
            console.error("❌ Login error:", err);
            return { success: false, error: err.message };
        }
    }

    // === Utility: Check if email is registered ===
    async function checkEmailRegistration(email) {
        try {
            const res = await fetch(API_REGISTER_INFO, {
                method: "POST",
                mode: "cors",
                credentials: "include",
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "content-type": "application/json",
                },
                body: JSON.stringify({ email: email })
            });

            if (!res.ok) {
                throw new Error(`Failed to check email: ${res.status}`);
            }

            const data = await res.json();
            return { success: true, data };
        } catch (err) {
            console.error("❌ Email check error:", err);
            return { success: false, error: err.message };
        }
    }

    // === Create the main popup with saved accounts ===
    function createMainPopup() {
        const oldPopup = document.getElementById("gimloader-switch-main-popup");
        if (oldPopup) oldPopup.remove();

        const popup = document.createElement("div");
        popup.id = "gimloader-switch-main-popup";
        Object.assign(popup.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "#1e1e2f",
            color: "#fff",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 0 20px rgba(0,0,0,0.3)",
            zIndex: "9999",
            minWidth: "450px",
            maxHeight: "600px",
            overflowY: "auto",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px"
        });

        const title = document.createElement("h3");
        title.innerText = "🔄 Switch Account";
        Object.assign(title.style, {
            marginBottom: "20px",
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
            fontSize: "24px",
            cursor: "pointer"
        });
        closeBtn.onclick = () => popup.remove();
        popup.appendChild(closeBtn);

        // Saved accounts section
        const accounts = getSavedAccounts();
        
        if (accounts.length > 0) {
            const savedTitle = document.createElement("h4");
            savedTitle.innerText = "💾 Saved Accounts";
            Object.assign(savedTitle.style, {
                marginBottom: "10px",
                color: "#00e1ff",
                fontSize: "16px"
            });
            popup.appendChild(savedTitle);

            // Sort by last used
            accounts.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));

            accounts.forEach((account, index) => {
                const accountBox = document.createElement("div");
                Object.assign(accountBox.style, {
                    backgroundColor: "#2a2a3d",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                });

                const accountInfo = document.createElement("div");
                accountInfo.style.flex = "1";

                const emailText = document.createElement("div");
                emailText.innerText = account.email;
                emailText.style.fontWeight = "bold";
                emailText.style.color = "#fff";
                accountInfo.appendChild(emailText);

                const lastUsedText = document.createElement("div");
                lastUsedText.innerText = account.lastUsed 
                    ? `Last used: ${new Date(account.lastUsed).toLocaleDateString()}`
                    : "Never used";
                lastUsedText.style.fontSize = "12px";
                lastUsedText.style.color = "#aaa";
                accountInfo.appendChild(lastUsedText);

                const buttonContainer = document.createElement("div");
                Object.assign(buttonContainer.style, {
                    display: "flex",
                    gap: "8px"
                });

                // Switch button
                const switchBtn = document.createElement("button");
                switchBtn.innerText = "🔄";
                Object.assign(switchBtn.style, {
                    backgroundColor: "#00e1ff",
                    color: "#1e1e2f",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    transition: "background 0.2s"
                });
                switchBtn.onmouseover = () => (switchBtn.style.backgroundColor = "#00b8cc");
                switchBtn.onmouseleave = () => (switchBtn.style.backgroundColor = "#00e1ff");
                switchBtn.onclick = async () => {
                    popup.remove();
                    await performLogout();
                    const result = await performLogin(account.email, account.password, false);
                    if (result.success) {
                        window.location.reload();
                    } else {
                        alert(`❌ Failed to switch to ${account.email}: ${result.error}`);
                        createMainPopup();
                    }
                };

                // Delete button
                const deleteBtn = document.createElement("button");
                deleteBtn.innerText = "🗑️";
                Object.assign(deleteBtn.style, {
                    backgroundColor: "#ff6b6b",
                    color: "#fff",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    transition: "background 0.2s"
                });
                deleteBtn.onmouseover = () => (deleteBtn.style.backgroundColor = "#ff5252");
                deleteBtn.onmouseleave = () => (deleteBtn.style.backgroundColor = "#ff6b6b");
                deleteBtn.onclick = () => {
                    if (confirm(`Delete ${account.email}?`)) {
                        deleteAccount(account.email);
                        createMainPopup();
                    }
                };

                buttonContainer.appendChild(switchBtn);
                buttonContainer.appendChild(deleteBtn);

                accountBox.appendChild(accountInfo);
                accountBox.appendChild(buttonContainer);
                popup.appendChild(accountBox);
            });

            const divider = document.createElement("hr");
            Object.assign(divider.style, {
                border: "none",
                borderTop: "1px solid #3b3b5c",
                margin: "20px 0"
            });
            popup.appendChild(divider);
        }

        // Add new account section
        const newAccountTitle = document.createElement("h4");
        newAccountTitle.innerText = "➕ Add New Account";
        Object.assign(newAccountTitle.style, {
            marginBottom: "15px",
            color: "#00e1ff",
            fontSize: "16px"
        });
        popup.appendChild(newAccountTitle);

        const addAccountBtn = document.createElement("button");
        addAccountBtn.innerText = "🔑 Login with New Account";
        Object.assign(addAccountBtn.style, {
            width: "100%",
            padding: "12px",
            backgroundColor: "#3b3b5c",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "15px",
            transition: "background 0.2s"
        });
        addAccountBtn.onmouseover = () => (addAccountBtn.style.backgroundColor = "#4a4a6d");
        addAccountBtn.onmouseleave = () => (addAccountBtn.style.backgroundColor = "#3b3b5c");
        addAccountBtn.onclick = () => {
            popup.remove();
            createLoginPopup();
        };
        popup.appendChild(addAccountBtn);

        document.body.appendChild(popup);
    }

    // === Create the login popup ===
    function createLoginPopup() {
        const oldPopup = document.getElementById("gimloader-switch-login-popup");
        if (oldPopup) oldPopup.remove();

        const popup = document.createElement("div");
        popup.id = "gimloader-switch-login-popup";
        Object.assign(popup.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "#1e1e2f",
            color: "#fff",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 0 20px rgba(0,0,0,0.3)",
            zIndex: "9999",
            minWidth: "400px",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px"
        });

        const title = document.createElement("h3");
        title.innerText = "🔑 Login New Account";
        Object.assign(title.style, {
            marginBottom: "20px",
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
            fontSize: "24px",
            cursor: "pointer"
        });
        closeBtn.onclick = () => {
            popup.remove();
            createMainPopup();
        };
        popup.appendChild(closeBtn);

        // Back button
        const backBtn = document.createElement("button");
        backBtn.innerText = "← Back";
        Object.assign(backBtn.style, {
            padding: "6px 12px",
            backgroundColor: "#3b3b5c",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "13px",
            marginBottom: "15px"
        });
        backBtn.onclick = () => {
            popup.remove();
            createMainPopup();
        };
        popup.appendChild(backBtn);

        // Email input
        const emailLabel = document.createElement("label");
        emailLabel.innerText = "Email:";
        emailLabel.style.display = "block";
        emailLabel.style.marginBottom = "5px";
        emailLabel.style.color = "#aaa";
        popup.appendChild(emailLabel);

        const emailInput = document.createElement("input");
        emailInput.type = "email";
        emailInput.placeholder = "your.email@example.com";
        Object.assign(emailInput.style, {
            width: "100%",
            padding: "10px",
            marginBottom: "15px",
            backgroundColor: "#2a2a3d",
            color: "#fff",
            border: "1px solid #3b3b5c",
            borderRadius: "6px",
            fontFamily: "inherit",
            fontSize: "14px",
            boxSizing: "border-box"
        });
        popup.appendChild(emailInput);

        // Password input
        const passwordLabel = document.createElement("label");
        passwordLabel.innerText = "Password:";
        passwordLabel.style.display = "block";
        passwordLabel.style.marginBottom = "5px";
        passwordLabel.style.color = "#aaa";
        popup.appendChild(passwordLabel);

        const passwordInput = document.createElement("input");
        passwordInput.type = "password";
        passwordInput.placeholder = "••••••••";
        Object.assign(passwordInput.style, {
            width: "100%",
            padding: "10px",
            marginBottom: "15px",
            backgroundColor: "#2a2a3d",
            color: "#fff",
            border: "1px solid #3b3b5c",
            borderRadius: "6px",
            fontFamily: "inherit",
            fontSize: "14px",
            boxSizing: "border-box"
        });
        popup.appendChild(passwordInput);

        // Save checkbox
        const saveContainer = document.createElement("div");
        Object.assign(saveContainer.style, {
            display: "flex",
            alignItems: "center",
            marginBottom: "20px"
        });

        const saveCheckbox = document.createElement("input");
        saveCheckbox.type = "checkbox";
        saveCheckbox.checked = true;
        saveCheckbox.id = "save-credentials-checkbox";
        saveCheckbox.style.marginRight = "8px";
        saveContainer.appendChild(saveCheckbox);

        const saveLabel = document.createElement("label");
        saveLabel.innerText = "💾 Save credentials for quick switching";
        saveLabel.htmlFor = "save-credentials-checkbox";
        saveLabel.style.color = "#aaa";
        saveLabel.style.fontSize = "13px";
        saveLabel.style.cursor = "pointer";
        saveContainer.appendChild(saveLabel);

        popup.appendChild(saveContainer);

        // Status message
        const statusMsg = document.createElement("div");
        Object.assign(statusMsg.style, {
            padding: "10px",
            marginBottom: "15px",
            borderRadius: "6px",
            textAlign: "center",
            display: "none",
            fontSize: "13px"
        });
        popup.appendChild(statusMsg);

        // Show status helper
        function showStatus(message, isError = false) {
            statusMsg.innerText = message;
            statusMsg.style.display = "block";
            statusMsg.style.backgroundColor = isError ? "#ff6b6b33" : "#00e1ff33";
            statusMsg.style.color = isError ? "#ff6b6b" : "#00e1ff";
        }

        // Login button
        const loginBtn = document.createElement("button");
        loginBtn.innerText = "🔄 Switch Account";
        Object.assign(loginBtn.style, {
            width: "100%",
            padding: "12px",
            backgroundColor: "#00e1ff",
            color: "#1e1e2f",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "15px",
            transition: "background 0.2s",
            marginBottom: "10px"
        });
        loginBtn.onmouseover = () => (loginBtn.style.backgroundColor = "#00b8cc");
        loginBtn.onmouseleave = () => (loginBtn.style.backgroundColor = "#00e1ff");
        
        loginBtn.onclick = async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const shouldSave = saveCheckbox.checked;

            if (!email || !password) {
                showStatus("⚠️ Please enter both email and password", true);
                return;
            }

            loginBtn.disabled = true;
            loginBtn.innerText = "⏳ Switching...";
            showStatus("🔄 Logging out current account...", false);

            // Logout first
            await performLogout();

            showStatus("🔄 Logging into new account...", false);

            const result = await performLogin(email, password, shouldSave);

            if (result.success) {
                showStatus("✅ Account switched! Reloading page...", false);
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showStatus(`❌ Login failed: ${result.error}`, true);
                loginBtn.disabled = false;
                loginBtn.innerText = "🔄 Switch Account";
            }
        };
        popup.appendChild(loginBtn);

        // Check email button
        const checkEmailBtn = document.createElement("button");
        checkEmailBtn.innerText = "🔍 Check if Email is Registered";
        Object.assign(checkEmailBtn.style, {
            width: "100%",
            padding: "10px",
            backgroundColor: "#3b3b5c",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            transition: "background 0.2s"
        });
        checkEmailBtn.onmouseover = () => (checkEmailBtn.style.backgroundColor = "#4a4a6d");
        checkEmailBtn.onmouseleave = () => (checkEmailBtn.style.backgroundColor = "#3b3b5c");
        
        checkEmailBtn.onclick = async () => {
            const email = emailInput.value.trim();

            if (!email) {
                showStatus("⚠️ Please enter an email address", true);
                return;
            }

            checkEmailBtn.disabled = true;
            checkEmailBtn.innerText = "⏳ Checking...";

            const result = await checkEmailRegistration(email);

            if (result.success) {
                const isRegistered = result.data.registered || result.data.exists;
                showStatus(
                    isRegistered 
                        ? "✅ Email is registered!" 
                        : "ℹ️ Email not found in system",
                    !isRegistered
                );
            } else {
                showStatus(`❌ Check failed: ${result.error}`, true);
            }

            checkEmailBtn.disabled = false;
            checkEmailBtn.innerText = "🔍 Check if Email is Registered";
        };
        popup.appendChild(checkEmailBtn);

        // Enter key support
        const handleEnter = (e) => {
            if (e.key === "Enter") {
                loginBtn.click();
            }
        };
        emailInput.addEventListener("keypress", handleEnter);
        passwordInput.addEventListener("keypress", handleEnter);

        document.body.appendChild(popup);
    }

    // === Add Switch Account button to header ===
    function addSwitchButton() {
        // Find the header element
        const header = document.querySelector('header.sc-hndUf');
        if (!header) {
            return false;
        }

        // Check if button already exists
        if (document.getElementById("gimloader-switch-account-btn")) {
            return true;
        }

        // Find the container with the profile/settings area
        const headerContainer = header.querySelector('.sc-cbrqwu');
        if (!headerContainer) {
            return false;
        }

        // Create the switch account button
        const switchBtn = document.createElement("button");
        switchBtn.id = "gimloader-switch-account-btn";
        switchBtn.innerText = "🔄 Switch Account";
        Object.assign(switchBtn.style, {
            padding: "8px 16px",
            backgroundColor: "#00e1ff",
            color: "#1e1e2f",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
            fontFamily: "Inter, sans-serif",
            transition: "all 0.2s",
            marginRight: "12px"
        });

        switchBtn.onmouseover = () => {
            switchBtn.style.backgroundColor = "#00b8cc";
            switchBtn.style.transform = "scale(1.05)";
        };
        switchBtn.onmouseleave = () => {
            switchBtn.style.backgroundColor = "#00e1ff";
            switchBtn.style.transform = "scale(1)";
        };

        switchBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            createMainPopup();
        };

        // Insert the button at the beginning of the container
        headerContainer.insertBefore(switchBtn, headerContainer.firstChild);

        console.log("✅ Switch Account button added to header!");
        return true;
    }

    // === Try to add button with retries ===
    function tryAddButton() {
        let attempts = 0;
        const maxAttempts = 20;

        const interval = setInterval(() => {
            attempts++;
            if (addSwitchButton() || attempts >= maxAttempts) {
                clearInterval(interval);
                if (attempts >= maxAttempts) {
                    console.log("⚠️ Failed to add Switch Account button - header not found");
                }
            }
        }, 500);
    }

    // Wait for DOM to be ready before starting
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryAddButton);
    } else {
        tryAddButton();
    }

    // Also try when DOM changes (for single-page app navigation)
    // Only create observer if document.body exists
    if (document.body) {
        const observer = new MutationObserver(() => {
            if (!document.getElementById("gimloader-switch-account-btn")) {
                tryAddButton();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        // If body doesn't exist yet, wait for it
        window.addEventListener('load', () => {
            const observer = new MutationObserver(() => {
                if (!document.getElementById("gimloader-switch-account-btn")) {
                    tryAddButton();
                }
            });

            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        });
    }

    console.log("✅ SwitchAccountButton plugin loaded!");

})();
