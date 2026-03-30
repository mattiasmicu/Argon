use tauri::command;
use tauri::{Emitter, Manager, WebviewWindowBuilder};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use tokio::time::{sleep, Duration};
use std::fs;
use std::path::PathBuf;

const CLIENT_ID: &str = "a729e3e8-23aa-4754-9954-28a822c698a0";

// ── Structs ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfile {
    pub uuid: String,
    pub username: String,
    pub token: String,
    pub refresh: String,
    pub skin: Option<String>,
    pub tier: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceCodeInfo {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Deserialize)]
struct MSDeviceCodeResponse {
    user_code: String,
    device_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Deserialize)]
struct MSTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    error: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Serialize)]
struct XboxAuthRequest {
    Properties: XboxAuthProps,
    RelyingParty: String,
    TokenType: String,
}

#[allow(non_snake_case)]
#[derive(Serialize)]
struct XboxAuthProps {
    AuthMethod: String,
    SiteName: String,
    RpsTicket: String,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct XboxAuthResponse {
    Token: String,
    DisplayClaims: DisplayClaims,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
struct DisplayClaims {
    xui: Vec<Xui>,
}

#[derive(Deserialize)]
struct Xui {
    uhs: String,
}

#[allow(non_snake_case)]
#[derive(Serialize)]
struct XSTSRequest {
    Properties: XSTSProps,
    RelyingParty: String,
    TokenType: String,
}

#[allow(non_snake_case)]
#[derive(Serialize)]
struct XSTSProps {
    SandboxId: String,
    UserTokens: Vec<String>,
}

#[derive(Deserialize)]
struct MCLinkResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct MCProfileResponse {
    id: String,
    name: String,
    skins: Vec<MCSkin>,
}

#[derive(Deserialize)]
struct MCSkin {
    url: String,
}

// ── Commands ───────────────────────────────────────────────────────────────────

#[command]
pub async fn open_link_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
    WebviewWindowBuilder::new(
        &app,
        "mslink",
        tauri::WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?),
    )
    .title(&format!("Sign in — {}", url))
    .inner_size(520.0, 700.0)
    .center()
    .resizable(false)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn close_link_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("mslink") {
        let _ = win.close().ok();
    }
    Ok(())
}

#[command]
pub async fn start_device_auth() -> Result<DeviceCodeInfo, String> {
    let client = Client::new();

    let resp = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
        .form(&[
            ("client_id", CLIENT_ID),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    println!("[auth] device code response: {}", text);
    let dc: MSDeviceCodeResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Device code parse failed: {} — body: {}", e, text))?;

    Ok(DeviceCodeInfo {
        user_code: dc.user_code,
        device_code: dc.device_code,
        verification_uri: dc.verification_uri,
        expires_in: dc.expires_in,
        interval: dc.interval,
    })
}

/// Spawns the polling loop in the background.
/// Emits "auth-success" with UserProfile or "auth-error" with a message when done.
/// Returns immediately so the frontend stays unblocked.
#[command]
pub async fn poll_device_auth(
    app: tauri::AppHandle,
    device_code: String,
    interval: u64,
) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        let client = Client::new();
        let poll_interval = Duration::from_secs(interval.max(5));

        loop {
            sleep(poll_interval).await;

            let resp = match client
                .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
                .form(&[
                    ("client_id", CLIENT_ID),
                    ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                    ("device_code", device_code.as_str()),
                ])
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    let _ = app.emit("auth-error", e.to_string());
                    return;
                }
            };

            let text = match resp.text().await {
                Ok(t) => t,
                Err(e) => {
                    let _ = app.emit("auth-error", e.to_string());
                    return;
                }
            };

            let token: MSTokenResponse = match serde_json::from_str(&text) {
                Ok(t) => t,
                Err(e) => {
                    let _ = app.emit("auth-error", format!("Parse failed: {} — body: {}", e, text));
                    return;
                }
            };

            match token.error.as_deref() {
                Some("authorization_pending") => {
                    let _ = app.emit("auth-status", "waiting");
                    continue;
                }
                Some("slow_down") => {
                    sleep(Duration::from_secs(5)).await;
                    continue;
                }
                Some("expired_token") => {
                    let _ = app.emit("auth-error", "Sign-in timed out. Please try again.");
                    return;
                }
                Some(other) => {
                    let _ = app.emit("auth-error", format!("Auth error: {}", other));
                    return;
                }
                None => {
                    let access_token = match token.access_token {
                        Some(t) => t,
                        None => {
                            let _ = app.emit("auth-error", "No access token in response");
                            return;
                        }
                    };
                    let refresh_token = match token.refresh_token {
                        Some(t) => t,
                        None => {
                            let _ = app.emit("auth-error", "No refresh token in response");
                            return;
                        }
                    };

                    let _ = app.emit("auth-status", "authenticating");

                    match run_xbox_chain(access_token, refresh_token).await {
                        Ok(profile) => {
                            let _ = app.emit("auth-success", profile);
                        }
                        Err(e) => {
                            let _ = app.emit("auth-error", e);
                        }
                    }
                    return;
                }
            }
        }
    });

    Ok(())
}

#[command]
pub async fn refresh_token(refresh: String) -> Result<UserProfile, String> {
    let client = Client::new();

    let resp = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("client_id", CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh.as_str()),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    let token: MSTokenResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Refresh parse failed: {} — body: {}", e, text))?;

    if let Some(err) = token.error {
        return Err(format!("Refresh failed: {}", err));
    }

    let access_token = token.access_token.ok_or("No access token")?;
    let refresh_token = token.refresh_token.ok_or("No refresh token")?;

    run_xbox_chain(access_token, refresh_token).await
}

#[command]
pub async fn try_official_launcher_auth() -> Result<UserProfile, String> {
    // Try multiple official launcher files
    let paths = get_official_launcher_paths();
    
    eprintln!("[auth] Checking {} launcher paths:", paths.len());
    for (i, path) in paths.iter().enumerate() {
        eprintln!("[auth] Path {}: {} (exists: {})", i, path.display(), path.exists());
    }
    
    for launcher_path in paths {
        if !launcher_path.exists() {
            continue;
        }
        
        eprintln!("[auth] Reading: {}", launcher_path.display());
        
        let content = match fs::read_to_string(&launcher_path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[auth] Failed to read: {}", e);
                continue;
            }
        };
        
        // Debug: print first 500 chars
        eprintln!("[auth] Content preview: {}", &content[..content.len().min(500)]);
        
        let launcher_data: serde_json::Value = match serde_json::from_str(&content) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("[auth] JSON parse error: {}", e);
                continue;
            }
        };
        
        // Try new format first (accounts object)
        if let Some(accounts) = launcher_data.get("accounts").and_then(|a| a.as_object()) {
            eprintln!("[auth] Found {} accounts", accounts.len());
            for (account_id, account) in accounts {
                eprintln!("[auth] Checking account: {}", account_id);
                eprintln!("[auth] Account JSON: {}", serde_json::to_string_pretty(account).unwrap_or_default());
                
                // Check if account is Microsoft type
                let account_type = account.get("type").and_then(|t| t.as_str()).unwrap_or("");
                eprintln!("[auth] Account type: {}", account_type);
                
                // Get access token - try multiple field names (official launcher uses "accessToken")
                let mc_token = account.get("accessToken")
                    .and_then(|t| t.as_str())
                    .or_else(|| account.get("minecraftToken").and_then(|t| t.as_str()));
                
                if let Some(token) = mc_token {
                    eprintln!("[auth] Found token (len: {})", token.len());
                    
                    // Get username from minecraftProfile if available (newer format)
                    let username = account.get("minecraftProfile")
                        .and_then(|p| p.get("name"))
                        .and_then(|n| n.as_str())
                        .or_else(|| account.get("profile").and_then(|p| p.get("name")).and_then(|n| n.as_str()))
                        .or_else(|| account.get("username").and_then(|u| u.as_str()))
                        .unwrap_or("Player")
                        .to_string();
                    
                    // Get UUID from minecraftProfile if available (newer format)
                    let uuid = account.get("minecraftProfile")
                        .and_then(|p| p.get("id"))
                        .and_then(|i| i.as_str())
                        .or_else(|| account.get("profile").and_then(|p| p.get("id")).and_then(|i| i.as_str()))
                        .or_else(|| account.get("uuid").and_then(|u| u.as_str()))
                        .unwrap_or("")
                        .to_string();
                    
                    eprintln!("[auth] Username: {}, UUID: {}", username, uuid);
                    
                    // If token is empty but we have a refresh token, try to refresh via Microsoft
                    if token.is_empty() {
                        eprintln!("[auth] Token empty, trying Microsoft refresh...");
                        if let Some(refresh_token) = account.get("refreshToken").and_then(|r| r.as_str()) {
                            if !refresh_token.is_empty() {
                                eprintln!("[auth] Found refresh token in JSON, attempting refresh...");
                                match refresh_microsoft_token(refresh_token).await {
                                    Ok((new_access_token, new_refresh_token)) => {
                                        eprintln!("[auth] Token refreshed successfully!");
                                        // Now we need to get Minecraft token via Xbox chain
                                        match run_xbox_chain(new_access_token, new_refresh_token).await {
                                            Ok(profile) => {
                                                eprintln!("[auth] Xbox auth successful!");
                                                return Ok(profile);
                                            }
                                            Err(e) => {
                                                eprintln!("[auth] Xbox auth failed: {}", e);
                                                continue;
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("[auth] Token refresh failed: {}", e);
                                        continue;
                                    }
                                }
                            }
                        }
                        eprintln!("[auth] No refresh token in launcher file - official launcher stores it in macOS Keychain");
                        return Err("Official launcher stores tokens in macOS Keychain. Please use 'Sign in with Microsoft' instead.".to_string());
                    }
                    
                    // Try to get refresh token
                    let refresh = account.get("refreshToken")
                        .and_then(|r| r.as_str())
                        .unwrap_or("")
                        .to_string();
                    
                    // Verify the token works
                    eprintln!("[auth] Verifying token with Minecraft API...");
                    let client = Client::new();
                    let profile_check = client
                        .get("https://api.minecraftservices.com/minecraft/profile")
                        .bearer_auth(token)
                        .send()
                        .await;
                    
                    match profile_check {
                        Ok(resp) if resp.status().is_success() => {
                            eprintln!("[auth] Token valid!");
                            return Ok(UserProfile {
                                uuid: if uuid.is_empty() { account_id.clone() } else { uuid },
                                username,
                                token: token.to_string(),
                                refresh,
                                skin: None,
                                tier: "microsoft".to_string(),
                            });
                        }
                        Ok(resp) => {
                            eprintln!("[auth] Token invalid, status: {}", resp.status());
                            continue;
                        }
                        Err(e) => {
                            eprintln!("[auth] Token verification error: {}", e);
                            continue;
                        }
                    }
                } else {
                    eprintln!("[auth] No accessToken found for account");
                }
            }
        } else {
            eprintln!("[auth] No 'accounts' object found in launcher data");
        }
    }
    
    Err("No valid Microsoft account found in official launcher".to_string())
}

fn get_official_launcher_paths() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")] {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from(""));
        vec![
            home.join("Library/Application Support/minecraft/launcher_accounts.json"),
            home.join("Library/Application Support/minecraft/launcher_accounts_microsoft_store.json"),
            home.join("Library/Application Support/minecraft/launcher_profiles.json"),
        ]
    }
    #[cfg(target_os = "windows")] {
        let data = dirs::data_dir().unwrap_or_else(|| PathBuf::from(""));
        vec![
            data.join(".minecraft/launcher_accounts.json"),
            data.join(".minecraft/launcher_accounts_microsoft_store.json"),
            data.join(".minecraft/launcher_profiles.json"),
        ]
    }
    #[cfg(target_os = "linux")] {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from(""));
        vec![
            home.join(".minecraft/launcher_accounts.json"),
            home.join(".minecraft/launcher_accounts_microsoft_store.json"),
            home.join(".minecraft/launcher_profiles.json"),
        ]
    }
}

#[command]
pub async fn logout() -> Result<(), String> {
    Ok(())
}

// ── Internal auth chain ────────────────────────────────────────────────────────

async fn run_xbox_chain(
    ms_access_token: String,
    ms_refresh_token: String,
) -> Result<UserProfile, String> {
    let client = Client::new();

    let xbox_auth: XboxAuthResponse = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&XboxAuthRequest {
            Properties: XboxAuthProps {
                AuthMethod: "RPS".to_string(),
                SiteName: "user.auth.xboxlive.com".to_string(),
                RpsTicket: format!("d={}", ms_access_token),
            },
            RelyingParty: "http://auth.xboxlive.com".to_string(),
            TokenType: "JWT".to_string(),
        })
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| format!("Xbox auth failed: {}", e))?;

    let xsts: XboxAuthResponse = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&XSTSRequest {
            Properties: XSTSProps {
                SandboxId: "RETAIL".to_string(),
                UserTokens: vec![xbox_auth.Token],
            },
            RelyingParty: "rp://api.minecraftservices.com/".to_string(),
            TokenType: "JWT".to_string(),
        })
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| format!("XSTS failed: {}", e))?;

    let uhs = &xsts.DisplayClaims.xui[0].uhs;

    let mc_text = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&serde_json::json!({
            "identityToken": format!("XBL3.0 x={};{}", uhs, xsts.Token)
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    println!("[auth] mc login → {}", mc_text);
    let mc_token: MCLinkResponse = serde_json::from_str(&mc_text)
        .map_err(|e| format!("MC login failed: {} — body: {}", e, mc_text))?;

    let profile_text = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(&mc_token.access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    println!("[auth] mc profile → {}", profile_text);
    let profile: MCProfileResponse = serde_json::from_str(&profile_text)
        .map_err(|e| format!("MC profile failed: {} — body: {}", e, profile_text))?;

    Ok(UserProfile {
        uuid: profile.id,
        username: profile.name,
        token: mc_token.access_token,
        refresh: ms_refresh_token,
        skin: profile.skins.first().map(|s| s.url.clone()),
        tier: "microsoft".to_string(),
    })
}

// Helper function to refresh Microsoft token
async fn refresh_microsoft_token(refresh_token: &str) -> Result<(String, String), String> {
    let client = Client::new();
    
    let resp = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("client_id", CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let token: MSTokenResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Refresh parse failed: {} — body: {}", e, text))?;
    
    if let Some(err) = token.error {
        return Err(format!("Refresh failed: {}", err));
    }
    
    let access_token = token.access_token.ok_or("No access token")?;
    let new_refresh_token = token.refresh_token.ok_or("No refresh token")?;
    
    Ok((access_token, new_refresh_token))
}