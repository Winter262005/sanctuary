use std::fs;
use std::env;
use std::path::PathBuf;

fn get_vault_path() -> Result<PathBuf, String> {
    let home_dir = env::var("USERPROFILE").map_err(|_| "Could not find home directory")?;
    let mut path = PathBuf::from(home_dir);
    path.push("Sanctuary_Vault");
    
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

#[tauri::command]
fn get_system_status() -> String {
    let username = env::var("USERNAME").unwrap_or_else(|_| "OPERATOR".into());
    format!("KERNEL_ONLINE // USER: {}", username)
}

#[tauri::command]
fn get_vault_files() -> Result<Vec<String>, String> {
    let path = get_vault_path()?;
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    
    let files = entries
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            if path.extension()? == "vault" {
                Some(path.file_stem()?.to_str()?.to_string())
            } else {
                None
            }
        })
        .collect();
        
    Ok(files)
}

#[tauri::command]
fn save_vault_file(name: String, content: String) -> Result<String, String> {
    let mut path = get_vault_path()?;
    path.push(format!("{}.vault", name));
    
    let scrambled = content.chars().map(|c| (c as u8 ^ 0xAA) as char).collect::<String>();
    fs::write(&path, scrambled).map_err(|e| e.to_string())?;
    
    Ok(format!("FILE_SAVED: {}", name))
}

#[tauri::command]
fn load_vault_file(name: String) -> Result<String, String> {
    let mut path = get_vault_path()?;
    path.push(format!("{}.vault", name));
    
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let decrypted = data.chars().map(|c| (c as u8 ^ 0xAA) as char).collect::<String>();
    
    Ok(decrypted)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_status,
            get_vault_files,
            save_vault_file,
            load_vault_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}