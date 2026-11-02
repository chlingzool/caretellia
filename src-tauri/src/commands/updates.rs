use serde::Serialize;
use tauri::{Manager, ResourceId, Runtime, Webview};

const UNSTABLE_UPDATE_ENDPOINT: &str =
    "https://github.com/chlingzool/caretellia/releases/download/unstable/latest.json";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnstableUpdateMetadata {
    rid: ResourceId,
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
    raw_json: serde_json::Value,
}

#[tauri::command]
pub async fn check_unstable_update<R: Runtime>(
    webview: Webview<R>,
) -> Result<Option<UnstableUpdateMetadata>, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_updater::UpdaterExt;

        let endpoint = url::Url::parse(UNSTABLE_UPDATE_ENDPOINT)
            .map_err(|error| format!("Invalid unstable update endpoint: {error}"))?;
        let updater = webview
            .updater_builder()
            .endpoints(vec![endpoint])
            .map_err(|error| error.to_string())?
            .build()
            .map_err(|error| error.to_string())?;
        let Some(update) = updater.check().await.map_err(|error| error.to_string())? else {
            return Ok(None);
        };
        let current_version = update.current_version.clone();
        let version = update.version.clone();
        let date = update.date.map(|date| date.to_string());
        let body = update.body.clone();
        let raw_json = update.raw_json.clone();
        let rid = webview.resources_table().add(update);

        Ok(Some(UnstableUpdateMetadata {
            rid,
            current_version,
            version,
            date,
            body,
            raw_json,
        }))
    }

    #[cfg(not(desktop))]
    {
        let _ = webview;
        Err("Unstable updates are available only in desktop builds.".to_string())
    }
}
