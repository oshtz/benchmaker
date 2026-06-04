#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;

const CURRENT_SCHEMA_VERSION: i64 = 3;

// ============================================================================
// Data Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TestCaseMetadata {
    pub category: Option<String>,
    pub difficulty: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TestCase {
    pub id: String,
    pub prompt: String,
    pub expected_output: Option<String>,
    pub scoring_method: String,
    pub weight: f64,
    pub metadata: TestCaseMetadata,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TestSuite {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub system_prompt: String,
    pub judge_system_prompt: Option<String>,
    pub test_cases: Vec<TestCase>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScoringResult {
    pub score: f64,
    pub confidence: Option<f64>,
    pub notes: Option<String>,
    pub raw_score: Option<f64>,
    pub max_score: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelParameters {
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: i64,
    pub frequency_penalty: f64,
    pub presence_penalty: f64,
    pub benchmark_mode: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TestCaseResult {
    pub test_case_id: String,
    pub model_id: String,
    pub response: String,
    pub token_count: Option<i64>,
    pub prompt_tokens: Option<i64>,
    pub completion_tokens: Option<i64>,
    pub cost: Option<f64>,
    pub latency_ms: Option<i64>,
    pub status: String,
    pub error: Option<String>,
    pub score: Option<ScoringResult>,
    pub streamed_content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub id: String,
    pub test_suite_id: String,
    pub test_suite_name: String,
    pub models: Vec<String>,
    pub parameters: ModelParameters,
    pub results: Vec<TestCaseResult>,
    pub status: String,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub judge_model: Option<String>,
    pub error_count: Option<i64>,
    pub error_summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodeArenaOutput {
    pub model_id: String,
    pub raw_response: String,
    pub extracted_code: String,
    pub status: String,
    pub error: Option<String>,
    pub latency_ms: Option<i64>,
    pub prompt_tokens: Option<i64>,
    pub completion_tokens: Option<i64>,
    pub cost: Option<f64>,
    pub streamed_content: Option<String>,
    pub score: Option<ScoringResult>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodeArenaRun {
    pub id: String,
    #[serde(rename = "type")]
    pub run_type: String,
    pub prompt: String,
    pub system_prompt: String,
    pub models: Vec<String>,
    pub parameters: ModelParameters,
    pub outputs: Vec<CodeArenaOutput>,
    pub status: String,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub judge_model_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub active_test_suite_id: Option<String>,
    pub current_run_id: Option<String>,
    pub current_code_arena_run_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmakerDb {
    pub version: i64,
    pub updated_at: i64,
    pub test_suites: Vec<TestSuite>,
    pub runs: Vec<RunResult>,
    #[serde(default)]
    pub code_arena_runs: Vec<CodeArenaRun>,
    pub active_test_suite_id: Option<String>,
    pub current_run_id: Option<String>,
    pub current_code_arena_run_id: Option<String>,
}

// ============================================================================
// Database Setup & Migration
// ============================================================================

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "Unable to resolve app data directory.".to_string())?;
    fs::create_dir_all(&data_dir).map_err(|err| err.to_string())?;
    Ok(data_dir.join("benchmaker.sqlite"))
}

fn open_db(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    let conn = Connection::open(&path).map_err(|err| err.to_string())?;

    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|err| err.to_string())?;

    // Run migrations
    migrate_database(&conn)?;

    Ok(conn)
}

fn migrate_database(conn: &Connection) -> Result<(), String> {
    // Create schema_version table if not exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_version (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version INTEGER NOT NULL
        )",
        [],
    ).map_err(|err| err.to_string())?;

    // Get current version
    let current_version: i64 = conn
        .query_row("SELECT version FROM schema_version WHERE id = 1", [], |row| row.get(0))
        .optional()
        .map_err(|err| err.to_string())?
        .unwrap_or(0);

    if current_version < CURRENT_SCHEMA_VERSION {
        // Check if we have old snapshot table to migrate
        let has_old_snapshot: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='benchmaker_snapshot'",
                [],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;

        // Create new normalized tables
        create_normalized_tables(conn)?;

        // Migrate data from old snapshot if exists
        if has_old_snapshot && current_version < 2 {
            migrate_from_snapshot(conn)?;
        }

        // Update schema version
        conn.execute(
            "INSERT INTO schema_version (id, version) VALUES (1, ?)
             ON CONFLICT(id) DO UPDATE SET version = excluded.version",
            params![CURRENT_SCHEMA_VERSION],
        ).map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn create_normalized_tables(conn: &Connection) -> Result<(), String> {
    // Test Suites table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_suites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            system_prompt TEXT NOT NULL,
            judge_system_prompt TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|err| err.to_string())?;

    // Test Cases table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_cases (
            id TEXT PRIMARY KEY,
            test_suite_id TEXT NOT NULL,
            prompt TEXT NOT NULL,
            expected_output TEXT,
            scoring_method TEXT NOT NULL,
            weight REAL NOT NULL DEFAULT 1.0,
            category TEXT,
            difficulty TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            sort_order INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (test_suite_id) REFERENCES test_suites(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|err| err.to_string())?;

    // Runs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS runs (
            id TEXT PRIMARY KEY,
            test_suite_id TEXT NOT NULL,
            test_suite_name TEXT NOT NULL,
            models TEXT NOT NULL,
            parameters TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            completed_at INTEGER,
            judge_model TEXT,
            error_count INTEGER,
            error_summary TEXT
        )",
        [],
    ).map_err(|err| err.to_string())?;

    // Test Case Results table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_case_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            test_case_id TEXT NOT NULL,
            model_id TEXT NOT NULL,
            response TEXT NOT NULL DEFAULT '',
            token_count INTEGER,
            prompt_tokens INTEGER,
            completion_tokens INTEGER,
            cost REAL,
            latency_ms INTEGER,
            status TEXT NOT NULL,
            error TEXT,
            score TEXT,
            streamed_content TEXT,
            FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|err| err.to_string())?;

    // App State table (singleton)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            active_test_suite_id TEXT,
            current_run_id TEXT,
            current_code_arena_run_id TEXT
        )",
        [],
    ).map_err(|err| err.to_string())?;

    // Code Arena runs are intentionally stored as versioned JSON payloads:
    // they are append-heavy, less queryable today, and must round-trip exactly.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS code_arena_runs (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            started_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|err| err.to_string())?;

    ensure_column(conn, "runs", "error_count", "INTEGER")?;
    ensure_column(conn, "runs", "error_summary", "TEXT")?;
    ensure_column(conn, "test_case_results", "prompt_tokens", "INTEGER")?;
    ensure_column(conn, "test_case_results", "completion_tokens", "INTEGER")?;
    ensure_column(conn, "test_case_results", "cost", "REAL")?;
    ensure_column(conn, "app_state", "current_code_arena_run_id", "TEXT")?;

    // Initialize app_state if empty
    conn.execute(
        "INSERT OR IGNORE INTO app_state (id, active_test_suite_id, current_run_id, current_code_arena_run_id) VALUES (1, NULL, NULL, NULL)",
        [],
    ).map_err(|err| err.to_string())?;

    // Create indexes for common queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON test_cases(test_suite_id)",
        [],
    ).map_err(|err| err.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_results_run ON test_case_results(run_id)",
        [],
    ).map_err(|err| err.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_runs_suite ON runs(test_suite_id)",
        [],
    ).map_err(|err| err.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_code_arena_runs_started ON code_arena_runs(started_at DESC)",
        [],
    ).map_err(|err| err.to_string())?;

    Ok(())
}

fn ensure_column(
    conn: &Connection,
    table_name: &str,
    column_name: &str,
    column_type: &str,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", table_name))
        .map_err(|err| err.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|err| err.to_string())?;

    for column in columns {
        if column.map_err(|err| err.to_string())? == column_name {
            return Ok(());
        }
    }

    conn.execute(
        &format!("ALTER TABLE {} ADD COLUMN {} {}", table_name, column_name, column_type),
        [],
    )
    .map_err(|err| err.to_string())?;

    Ok(())
}

fn migrate_from_snapshot(conn: &Connection) -> Result<(), String> {
    // Read old snapshot
    let payload: Option<String> = conn
        .query_row(
            "SELECT payload FROM benchmaker_snapshot WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    if let Some(json_payload) = payload {
        let old_data: BenchmakerDb = serde_json::from_str(&json_payload)
            .map_err(|err| format!("Failed to parse old snapshot: {}", err))?;

        // Migrate test suites and test cases
        for suite in &old_data.test_suites {
            conn.execute(
                "INSERT OR REPLACE INTO test_suites (id, name, description, system_prompt, judge_system_prompt, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    suite.id,
                    suite.name,
                    suite.description,
                    suite.system_prompt,
                    suite.judge_system_prompt,
                    suite.created_at,
                    suite.updated_at,
                ],
            ).map_err(|err| err.to_string())?;

            for (idx, test_case) in suite.test_cases.iter().enumerate() {
                let tags_json = serde_json::to_string(&test_case.metadata.tags)
                    .unwrap_or_else(|_| "[]".to_string());

                conn.execute(
                    "INSERT OR REPLACE INTO test_cases (id, test_suite_id, prompt, expected_output, scoring_method, weight, category, difficulty, tags, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        test_case.id,
                        suite.id,
                        test_case.prompt,
                        test_case.expected_output,
                        test_case.scoring_method,
                        test_case.weight,
                        test_case.metadata.category,
                        test_case.metadata.difficulty,
                        tags_json,
                        idx as i64,
                    ],
                ).map_err(|err| err.to_string())?;
            }
        }

        // Migrate runs and results
        for run in &old_data.runs {
            let models_json = serde_json::to_string(&run.models)
                .unwrap_or_else(|_| "[]".to_string());
            let params_json = serde_json::to_string(&run.parameters)
                .unwrap_or_else(|_| "{}".to_string());

            conn.execute(
                "INSERT OR REPLACE INTO runs (id, test_suite_id, test_suite_name, models, parameters, status, started_at, completed_at, judge_model, error_count, error_summary)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    run.id,
                    run.test_suite_id,
                    run.test_suite_name,
                    models_json,
                    params_json,
                    run.status,
                    run.started_at,
                    run.completed_at,
                    run.judge_model,
                    run.error_count,
                    run.error_summary,
                ],
            ).map_err(|err| err.to_string())?;

            for result in &run.results {
                let score_json = result.score.as_ref()
                    .map(|s| serde_json::to_string(s).unwrap_or_else(|_| "null".to_string()));

                conn.execute(
                    "INSERT INTO test_case_results (run_id, test_case_id, model_id, response, token_count, prompt_tokens, completion_tokens, cost, latency_ms, status, error, score, streamed_content)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        run.id,
                        result.test_case_id,
                        result.model_id,
                        result.response,
                        result.token_count,
                        result.prompt_tokens,
                        result.completion_tokens,
                        result.cost,
                        result.latency_ms,
                        result.status,
                        result.error,
                        score_json,
                        result.streamed_content,
                    ],
                ).map_err(|err| err.to_string())?;
            }
        }

        // Migrate app state
        conn.execute(
            "UPDATE app_state SET active_test_suite_id = ?, current_run_id = ?, current_code_arena_run_id = ? WHERE id = 1",
            params![
                old_data.active_test_suite_id,
                old_data.current_run_id,
                old_data.current_code_arena_run_id,
            ],
        ).map_err(|err| err.to_string())?;

        write_code_arena_runs(conn, &old_data.code_arena_runs)?;

        // Drop old snapshot table after successful migration
        conn.execute("DROP TABLE IF EXISTS benchmaker_snapshot", [])
            .map_err(|err| err.to_string())?;
    }

    Ok(())
}

// ============================================================================
// Tauri Commands - Test Suites
// ============================================================================

#[tauri::command]
fn get_all_test_suites(app: AppHandle) -> Result<Vec<TestSuite>, String> {
    let conn = open_db(&app)?;

    let mut stmt = conn
        .prepare("SELECT id, name, description, system_prompt, judge_system_prompt, created_at, updated_at FROM test_suites ORDER BY updated_at DESC")
        .map_err(|err| err.to_string())?;

    let suite_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
            ))
        })
        .map_err(|err| err.to_string())?;

    let mut suites = Vec::new();
    for row in suite_rows {
        let (id, name, description, system_prompt, judge_system_prompt, created_at, updated_at) = row.map_err(|err| err.to_string())?;

        // Get test cases for this suite
        let test_cases = get_test_cases_for_suite(&conn, &id)?;

        suites.push(TestSuite {
            id,
            name,
            description,
            system_prompt,
            judge_system_prompt,
            test_cases,
            created_at,
            updated_at,
        });
    }

    Ok(suites)
}

fn get_test_cases_for_suite(conn: &Connection, suite_id: &str) -> Result<Vec<TestCase>, String> {
    let mut stmt = conn
        .prepare("SELECT id, prompt, expected_output, scoring_method, weight, category, difficulty, tags FROM test_cases WHERE test_suite_id = ? ORDER BY sort_order")
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map(params![suite_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, String>(7)?,
            ))
        })
        .map_err(|err| err.to_string())?;

    let mut test_cases = Vec::new();
    for row in rows {
        let (id, prompt, expected_output, scoring_method, weight, category, difficulty, tags_json) = row.map_err(|err| err.to_string())?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

        test_cases.push(TestCase {
            id,
            prompt,
            expected_output,
            scoring_method,
            weight,
            metadata: TestCaseMetadata {
                category,
                difficulty,
                tags,
            },
        });
    }

    Ok(test_cases)
}

#[tauri::command]
fn save_test_suite(app: AppHandle, suite: TestSuite) -> Result<(), String> {
    let conn = open_db(&app)?;

    conn.execute(
        "INSERT INTO test_suites (id, name, description, system_prompt, judge_system_prompt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           system_prompt = excluded.system_prompt,
           judge_system_prompt = excluded.judge_system_prompt,
           updated_at = excluded.updated_at",
        params![
            suite.id,
            suite.name,
            suite.description,
            suite.system_prompt,
            suite.judge_system_prompt,
            suite.created_at,
            suite.updated_at,
        ],
    ).map_err(|err| err.to_string())?;

    // Delete existing test cases and re-insert (simpler than diffing)
    conn.execute("DELETE FROM test_cases WHERE test_suite_id = ?", params![suite.id])
        .map_err(|err| err.to_string())?;

    for (idx, test_case) in suite.test_cases.iter().enumerate() {
        let tags_json = serde_json::to_string(&test_case.metadata.tags)
            .unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT INTO test_cases (id, test_suite_id, prompt, expected_output, scoring_method, weight, category, difficulty, tags, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                test_case.id,
                suite.id,
                test_case.prompt,
                test_case.expected_output,
                test_case.scoring_method,
                test_case.weight,
                test_case.metadata.category,
                test_case.metadata.difficulty,
                tags_json,
                idx as i64,
            ],
        ).map_err(|err| err.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn delete_test_suite(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute("DELETE FROM test_suites WHERE id = ?", params![id])
        .map_err(|err| err.to_string())?;
    Ok(())
}

// ============================================================================
// Tauri Commands - Runs
// ============================================================================

#[tauri::command]
fn get_all_runs(app: AppHandle) -> Result<Vec<RunResult>, String> {
    let conn = open_db(&app)?;

    let mut stmt = conn
        .prepare("SELECT id, test_suite_id, test_suite_name, models, parameters, status, started_at, completed_at, judge_model, error_count, error_summary FROM runs ORDER BY started_at DESC")
        .map_err(|err| err.to_string())?;

    let run_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<i64>>(9)?,
                row.get::<_, Option<String>>(10)?,
            ))
        })
        .map_err(|err| err.to_string())?;

    let mut runs = Vec::new();
    for row in run_rows {
        let (id, test_suite_id, test_suite_name, models_json, params_json, status, started_at, completed_at, judge_model, error_count, error_summary) = row.map_err(|err| err.to_string())?;

        let models: Vec<String> = serde_json::from_str(&models_json).unwrap_or_default();
        let parameters: ModelParameters = serde_json::from_str(&params_json)
            .unwrap_or(ModelParameters {
                temperature: 0.7,
                top_p: 1.0,
                max_tokens: 1024,
                frequency_penalty: 0.0,
                presence_penalty: 0.0,
                benchmark_mode: Some(false),
            });

        let results = get_results_for_run(&conn, &id)?;

        runs.push(RunResult {
            id,
            test_suite_id,
            test_suite_name,
            models,
            parameters,
            results,
            status,
            started_at,
            completed_at,
            judge_model,
            error_count,
            error_summary,
        });
    }

    Ok(runs)
}

fn get_results_for_run(conn: &Connection, run_id: &str) -> Result<Vec<TestCaseResult>, String> {
    let mut stmt = conn
        .prepare("SELECT test_case_id, model_id, response, token_count, prompt_tokens, completion_tokens, cost, latency_ms, status, error, score, streamed_content FROM test_case_results WHERE run_id = ?")
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map(params![run_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<f64>>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, Option<String>>(10)?,
                row.get::<_, Option<String>>(11)?,
            ))
        })
        .map_err(|err| err.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        let (test_case_id, model_id, response, token_count, prompt_tokens, completion_tokens, cost, latency_ms, status, error, score_json, streamed_content) = row.map_err(|err| err.to_string())?;

        let score: Option<ScoringResult> = score_json
            .and_then(|s| serde_json::from_str(&s).ok());

        results.push(TestCaseResult {
            test_case_id,
            model_id,
            response,
            token_count,
            prompt_tokens,
            completion_tokens,
            cost,
            latency_ms,
            status,
            error,
            score,
            streamed_content,
        });
    }

    Ok(results)
}

#[tauri::command]
fn save_run(app: AppHandle, run: RunResult) -> Result<(), String> {
    let conn = open_db(&app)?;

    let models_json = serde_json::to_string(&run.models)
        .unwrap_or_else(|_| "[]".to_string());
    let params_json = serde_json::to_string(&run.parameters)
        .unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "INSERT INTO runs (id, test_suite_id, test_suite_name, models, parameters, status, started_at, completed_at, judge_model, error_count, error_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           completed_at = excluded.completed_at,
           error_count = excluded.error_count,
           error_summary = excluded.error_summary",
        params![
            run.id,
            run.test_suite_id,
            run.test_suite_name,
            models_json,
            params_json,
            run.status,
            run.started_at,
            run.completed_at,
            run.judge_model,
            run.error_count,
            run.error_summary,
        ],
    ).map_err(|err| err.to_string())?;

    // Delete existing results and re-insert
    conn.execute("DELETE FROM test_case_results WHERE run_id = ?", params![run.id])
        .map_err(|err| err.to_string())?;

    for result in &run.results {
        let score_json = result.score.as_ref()
            .map(|s| serde_json::to_string(s).unwrap_or_else(|_| "null".to_string()));

        conn.execute(
            "INSERT INTO test_case_results (run_id, test_case_id, model_id, response, token_count, prompt_tokens, completion_tokens, cost, latency_ms, status, error, score, streamed_content)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                run.id,
                result.test_case_id,
                result.model_id,
                result.response,
                result.token_count,
                result.prompt_tokens,
                result.completion_tokens,
                result.cost,
                result.latency_ms,
                result.status,
                result.error,
                score_json,
                result.streamed_content,
            ],
        ).map_err(|err| err.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn delete_run(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_db(&app)?;
    conn.execute("DELETE FROM runs WHERE id = ?", params![id])
        .map_err(|err| err.to_string())?;
    Ok(())
}

// ============================================================================
// Tauri Commands - App State
// ============================================================================

#[tauri::command]
fn get_app_state(app: AppHandle) -> Result<AppState, String> {
    let conn = open_db(&app)?;

    let state = conn
        .query_row(
            "SELECT active_test_suite_id, current_run_id, current_code_arena_run_id FROM app_state WHERE id = 1",
            [],
            |row| Ok(AppState {
                active_test_suite_id: row.get(0)?,
                current_run_id: row.get(1)?,
                current_code_arena_run_id: row.get(2)?,
            }),
        )
        .optional()
        .map_err(|err| err.to_string())?
        .unwrap_or(AppState {
            active_test_suite_id: None,
            current_run_id: None,
            current_code_arena_run_id: None,
        });

    Ok(state)
}

#[tauri::command]
fn save_app_state(app: AppHandle, state: AppState) -> Result<(), String> {
    let conn = open_db(&app)?;

    conn.execute(
        "INSERT INTO app_state (id, active_test_suite_id, current_run_id, current_code_arena_run_id)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           active_test_suite_id = excluded.active_test_suite_id,
           current_run_id = excluded.current_run_id,
           current_code_arena_run_id = excluded.current_code_arena_run_id",
        params![
            state.active_test_suite_id,
            state.current_run_id,
            state.current_code_arena_run_id,
        ],
    ).map_err(|err| err.to_string())?;

    Ok(())
}

// ============================================================================
// Legacy Command (for backwards compatibility during transition)
// ============================================================================

#[tauri::command]
fn read_snapshot(app: AppHandle) -> Result<Option<BenchmakerDb>, String> {
    let conn = open_db(&app)?;

    // Build snapshot from normalized tables
    let test_suites = get_all_test_suites_internal(&conn)?;
    let runs = get_all_runs_internal(&conn)?;
    let code_arena_runs = get_code_arena_runs_internal(&conn)?;
    let state = conn
        .query_row(
            "SELECT active_test_suite_id, current_run_id, current_code_arena_run_id FROM app_state WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .optional()
        .map_err(|err| err.to_string())?
        .unwrap_or((None, None, None));

    Ok(Some(BenchmakerDb {
        version: CURRENT_SCHEMA_VERSION,
        updated_at: chrono_now(),
        test_suites,
        runs,
        code_arena_runs,
        active_test_suite_id: state.0,
        current_run_id: state.1,
        current_code_arena_run_id: state.2,
    }))
}

#[tauri::command]
fn write_snapshot(app: AppHandle, snapshot: BenchmakerDb) -> Result<(), String> {
    let conn = open_db(&app)?;
    let tx = conn.unchecked_transaction().map_err(|err| err.to_string())?;

    // Write test suites
    for suite in &snapshot.test_suites {
        tx.execute(
            "INSERT INTO test_suites (id, name, description, system_prompt, judge_system_prompt, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               description = excluded.description,
               system_prompt = excluded.system_prompt,
               judge_system_prompt = excluded.judge_system_prompt,
               updated_at = excluded.updated_at",
            params![
                suite.id,
                suite.name,
                suite.description,
                suite.system_prompt,
                suite.judge_system_prompt,
                suite.created_at,
                suite.updated_at,
            ],
        ).map_err(|err| err.to_string())?;

        tx.execute("DELETE FROM test_cases WHERE test_suite_id = ?", params![suite.id])
            .map_err(|err| err.to_string())?;

        for (idx, test_case) in suite.test_cases.iter().enumerate() {
            let tags_json = serde_json::to_string(&test_case.metadata.tags)
                .unwrap_or_else(|_| "[]".to_string());

            tx.execute(
                "INSERT INTO test_cases (id, test_suite_id, prompt, expected_output, scoring_method, weight, category, difficulty, tags, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    test_case.id,
                    suite.id,
                    test_case.prompt,
                    test_case.expected_output,
                    test_case.scoring_method,
                    test_case.weight,
                    test_case.metadata.category,
                    test_case.metadata.difficulty,
                    tags_json,
                    idx as i64,
                ],
            ).map_err(|err| err.to_string())?;
        }
    }

    // Delete suites not in snapshot
    let suite_ids: Vec<String> = snapshot.test_suites.iter().map(|s| s.id.clone()).collect();
    if !suite_ids.is_empty() {
        let placeholders: String = suite_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let query = format!("DELETE FROM test_suites WHERE id NOT IN ({})", placeholders);
        let params: Vec<&dyn rusqlite::ToSql> = suite_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        tx.execute(&query, params.as_slice()).map_err(|err| err.to_string())?;
    } else {
        tx.execute("DELETE FROM test_suites", []).map_err(|err| err.to_string())?;
    }

    // Write runs
    for run in &snapshot.runs {
        let models_json = serde_json::to_string(&run.models)
            .unwrap_or_else(|_| "[]".to_string());
        let params_json = serde_json::to_string(&run.parameters)
            .unwrap_or_else(|_| "{}".to_string());

        tx.execute(
            "INSERT INTO runs (id, test_suite_id, test_suite_name, models, parameters, status, started_at, completed_at, judge_model, error_count, error_summary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               status = excluded.status,
               completed_at = excluded.completed_at,
               error_count = excluded.error_count,
               error_summary = excluded.error_summary",
            params![
                run.id,
                run.test_suite_id,
                run.test_suite_name,
                models_json,
                params_json,
                run.status,
                run.started_at,
                run.completed_at,
                run.judge_model,
                run.error_count,
                run.error_summary,
            ],
        ).map_err(|err| err.to_string())?;

        tx.execute("DELETE FROM test_case_results WHERE run_id = ?", params![run.id])
            .map_err(|err| err.to_string())?;

        for result in &run.results {
            let score_json = result.score.as_ref()
                .map(|s| serde_json::to_string(s).unwrap_or_else(|_| "null".to_string()));

            tx.execute(
                "INSERT INTO test_case_results (run_id, test_case_id, model_id, response, token_count, prompt_tokens, completion_tokens, cost, latency_ms, status, error, score, streamed_content)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    run.id,
                    result.test_case_id,
                    result.model_id,
                    result.response,
                    result.token_count,
                    result.prompt_tokens,
                    result.completion_tokens,
                    result.cost,
                    result.latency_ms,
                    result.status,
                    result.error,
                    score_json,
                    result.streamed_content,
                ],
            ).map_err(|err| err.to_string())?;
        }
    }

    // Delete runs not in snapshot
    let run_ids: Vec<String> = snapshot.runs.iter().map(|r| r.id.clone()).collect();
    if !run_ids.is_empty() {
        let placeholders: String = run_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let query = format!("DELETE FROM runs WHERE id NOT IN ({})", placeholders);
        let params: Vec<&dyn rusqlite::ToSql> = run_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        tx.execute(&query, params.as_slice()).map_err(|err| err.to_string())?;
    } else {
        tx.execute("DELETE FROM runs", []).map_err(|err| err.to_string())?;
    }

    write_code_arena_runs(&tx, &snapshot.code_arena_runs)?;

    // Update app state
    tx.execute(
        "UPDATE app_state SET active_test_suite_id = ?, current_run_id = ?, current_code_arena_run_id = ? WHERE id = 1",
        params![
            snapshot.active_test_suite_id,
            snapshot.current_run_id,
            snapshot.current_code_arena_run_id,
        ],
    ).map_err(|err| err.to_string())?;

    tx.commit().map_err(|err| err.to_string())
}

// Helper functions for internal use
fn get_all_test_suites_internal(conn: &Connection) -> Result<Vec<TestSuite>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, description, system_prompt, judge_system_prompt, created_at, updated_at FROM test_suites ORDER BY updated_at DESC")
        .map_err(|err| err.to_string())?;

    let suite_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
            ))
        })
        .map_err(|err| err.to_string())?;

    let mut suites = Vec::new();
    for row in suite_rows {
        let (id, name, description, system_prompt, judge_system_prompt, created_at, updated_at) = row.map_err(|err| err.to_string())?;
        let test_cases = get_test_cases_for_suite(conn, &id)?;

        suites.push(TestSuite {
            id,
            name,
            description,
            system_prompt,
            judge_system_prompt,
            test_cases,
            created_at,
            updated_at,
        });
    }

    Ok(suites)
}

fn get_all_runs_internal(conn: &Connection) -> Result<Vec<RunResult>, String> {
    let mut stmt = conn
        .prepare("SELECT id, test_suite_id, test_suite_name, models, parameters, status, started_at, completed_at, judge_model, error_count, error_summary FROM runs ORDER BY started_at DESC")
        .map_err(|err| err.to_string())?;

    let run_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<i64>>(9)?,
                row.get::<_, Option<String>>(10)?,
            ))
        })
        .map_err(|err| err.to_string())?;

    let mut runs = Vec::new();
    for row in run_rows {
        let (id, test_suite_id, test_suite_name, models_json, params_json, status, started_at, completed_at, judge_model, error_count, error_summary) = row.map_err(|err| err.to_string())?;

        let models: Vec<String> = serde_json::from_str(&models_json).unwrap_or_default();
        let parameters: ModelParameters = serde_json::from_str(&params_json)
            .unwrap_or(ModelParameters {
                temperature: 0.7,
                top_p: 1.0,
                max_tokens: 1024,
                frequency_penalty: 0.0,
                presence_penalty: 0.0,
                benchmark_mode: Some(false),
            });

        let results = get_results_for_run(conn, &id)?;

        runs.push(RunResult {
            id,
            test_suite_id,
            test_suite_name,
            models,
            parameters,
            results,
            status,
            started_at,
            completed_at,
            judge_model,
            error_count,
            error_summary,
        });
    }

    Ok(runs)
}

fn get_code_arena_runs_internal(conn: &Connection) -> Result<Vec<CodeArenaRun>, String> {
    let mut stmt = conn
        .prepare("SELECT id, payload FROM code_arena_runs ORDER BY started_at DESC")
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|err| err.to_string())?;

    let mut runs = Vec::new();
    for row in rows {
        let (id, payload) = row.map_err(|err| err.to_string())?;
        let run: CodeArenaRun = serde_json::from_str(&payload)
            .map_err(|err| format!("Failed to parse Code Arena run {}: {}", id, err))?;
        runs.push(run);
    }

    Ok(runs)
}

fn write_code_arena_runs(conn: &Connection, runs: &[CodeArenaRun]) -> Result<(), String> {
    conn.execute("DELETE FROM code_arena_runs", [])
        .map_err(|err| err.to_string())?;

    for run in runs {
        let payload = serde_json::to_string(run)
            .map_err(|err| format!("Failed to serialize Code Arena run {}: {}", run.id, err))?;
        conn.execute(
            "INSERT INTO code_arena_runs (id, payload, started_at) VALUES (?, ?, ?)",
            params![run.id, payload, run.started_at],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn chrono_now() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ============================================================================
// Credential Storage
// ============================================================================

const KEYRING_SERVICE: &str = "Benchmaker";
const OPENROUTER_API_KEY_USER: &str = "openrouter-api-key";

fn openrouter_api_key_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, OPENROUTER_API_KEY_USER)
        .map_err(|err| format!("Unable to access OS credential store: {}", err))
}

#[tauri::command]
fn get_stored_api_key() -> Result<Option<String>, String> {
    match openrouter_api_key_entry()?.get_password() {
        Ok(api_key) => Ok(Some(api_key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("Unable to read API key from OS credential store: {}", err)),
    }
}

#[tauri::command]
fn save_api_key(api_key: String) -> Result<(), String> {
    openrouter_api_key_entry()?
        .set_password(&api_key)
        .map_err(|err| format!("Unable to save API key to OS credential store: {}", err))
}

#[tauri::command]
fn clear_stored_api_key() -> Result<(), String> {
    match openrouter_api_key_entry()?.delete_password() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!(
            "Unable to clear API key from OS credential store: {}",
            err
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn has_column(conn: &Connection, table_name: &str, column_name: &str) -> bool {
        let mut stmt = conn
            .prepare(&format!("PRAGMA table_info({})", table_name))
            .expect("table info query should prepare");
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .expect("table info query should run");

        let found = columns
            .filter_map(Result::ok)
            .any(|column| column == column_name);

        found
    }

    fn sample_parameters() -> ModelParameters {
        ModelParameters {
            temperature: 0.0,
            top_p: 1.0,
            max_tokens: 1024,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            benchmark_mode: Some(true),
        }
    }

    fn sample_code_arena_run() -> CodeArenaRun {
        CodeArenaRun {
            id: "code-run-1".to_string(),
            run_type: "code-arena".to_string(),
            prompt: "Build a button".to_string(),
            system_prompt: "Return HTML only".to_string(),
            models: vec!["provider/model".to_string()],
            parameters: sample_parameters(),
            outputs: vec![CodeArenaOutput {
                model_id: "provider/model".to_string(),
                raw_response: "<button>Run</button>".to_string(),
                extracted_code: "<button>Run</button>".to_string(),
                status: "completed".to_string(),
                error: None,
                latency_ms: Some(120),
                prompt_tokens: Some(10),
                completion_tokens: Some(20),
                cost: Some(0.00003),
                streamed_content: Some("<button>Run</button>".to_string()),
                score: Some(ScoringResult {
                    score: 0.9,
                    confidence: Some(0.8),
                    notes: Some("Good".to_string()),
                    raw_score: Some(90.0),
                    max_score: Some(100.0),
                }),
            }],
            status: "completed".to_string(),
            started_at: 100,
            completed_at: Some(200),
            judge_model_id: Some("judge/model".to_string()),
        }
    }

    #[test]
    fn migrate_database_creates_v3_contract() {
        let conn = Connection::open_in_memory().expect("in-memory database should open");

        migrate_database(&conn).expect("migration should succeed");

        let version: i64 = conn
            .query_row("SELECT version FROM schema_version WHERE id = 1", [], |row| row.get(0))
            .expect("schema version should exist");

        assert_eq!(version, CURRENT_SCHEMA_VERSION);
        assert!(has_column(&conn, "runs", "error_count"));
        assert!(has_column(&conn, "runs", "error_summary"));
        assert!(has_column(&conn, "test_case_results", "prompt_tokens"));
        assert!(has_column(&conn, "test_case_results", "completion_tokens"));
        assert!(has_column(&conn, "test_case_results", "cost"));
        assert!(has_column(&conn, "app_state", "current_code_arena_run_id"));
    }

    #[test]
    fn code_arena_runs_round_trip_as_json_payloads() {
        let conn = Connection::open_in_memory().expect("in-memory database should open");
        migrate_database(&conn).expect("migration should succeed");

        let run = sample_code_arena_run();
        write_code_arena_runs(&conn, &[run.clone()]).expect("write should succeed");

        let loaded = get_code_arena_runs_internal(&conn).expect("read should succeed");

        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, run.id);
        assert_eq!(loaded[0].run_type, "code-arena");
        assert_eq!(loaded[0].outputs[0].prompt_tokens, Some(10));
        assert_eq!(loaded[0].outputs[0].cost, Some(0.00003));
        assert_eq!(loaded[0].judge_model_id.as_deref(), Some("judge/model"));
    }

    #[test]
    fn run_metadata_round_trips_from_normalized_tables() {
        let conn = Connection::open_in_memory().expect("in-memory database should open");
        migrate_database(&conn).expect("migration should succeed");

        let params_json = serde_json::to_string(&sample_parameters()).expect("params should serialize");
        conn.execute(
            "INSERT INTO runs (id, test_suite_id, test_suite_name, models, parameters, status, started_at, completed_at, judge_model, error_count, error_summary)
             VALUES ('run-1', 'suite-1', 'Suite', '[\"provider/model\"]', ?, 'completed', 100, 200, 'judge/model', 1, 'one failure')",
            params![params_json],
        )
        .expect("run insert should succeed");

        conn.execute(
            "INSERT INTO test_case_results (run_id, test_case_id, model_id, response, token_count, prompt_tokens, completion_tokens, cost, latency_ms, status, error, score, streamed_content)
             VALUES ('run-1', 'case-1', 'provider/model', 'ok', 30, 10, 20, 0.00003, 120, 'completed', NULL, '{\"score\":1,\"rawScore\":100,\"maxScore\":100}', 'ok')",
            [],
        )
        .expect("result insert should succeed");

        let runs = get_all_runs_internal(&conn).expect("runs should read");

        assert_eq!(runs.len(), 1);
        assert_eq!(runs[0].error_count, Some(1));
        assert_eq!(runs[0].error_summary.as_deref(), Some("one failure"));
        assert_eq!(runs[0].parameters.benchmark_mode, Some(true));
        assert_eq!(runs[0].results[0].prompt_tokens, Some(10));
        assert_eq!(runs[0].results[0].completion_tokens, Some(20));
        assert_eq!(runs[0].results[0].cost, Some(0.00003));
    }

    #[test]
    #[ignore]
    fn credential_store_round_trip_preserves_existing_openrouter_key() {
        let entry = openrouter_api_key_entry().expect("credential entry should be available");
        let original = match entry.get_password() {
            Ok(value) => Some(value),
            Err(keyring::Error::NoEntry) => None,
            Err(err) => panic!("failed to read original credential: {}", err),
        };
        let test_key = format!("sk-or-v1-benchmaker-smoke-{}", chrono_now());

        let smoke_result = (|| -> Result<(), String> {
            entry
                .set_password(&test_key)
                .map_err(|err| format!("failed to save smoke credential: {}", err))?;
            let stored = entry
                .get_password()
                .map_err(|err| format!("failed to read smoke credential: {}", err))?;
            if stored != test_key {
                return Err("stored smoke credential did not round-trip".to_string());
            }
            entry
                .delete_password()
                .map_err(|err| format!("failed to clear smoke credential: {}", err))?;
            match entry.get_password() {
                Err(keyring::Error::NoEntry) => Ok(()),
                Err(err) => Err(format!("credential clear could not be verified: {}", err)),
                Ok(_) => Err("credential was still present after clear".to_string()),
            }
        })();

        let restore_result = match original {
            Some(value) => entry
                .set_password(&value)
                .map_err(|err| format!("failed to restore original credential: {}", err)),
            None => match entry.delete_password() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                Err(err) => Err(format!("failed to restore missing credential state: {}", err)),
            },
        };

        if let Err(err) = restore_result {
            panic!("{}", err);
        }

        if let Err(err) = smoke_result {
            panic!("{}", err);
        }
    }

    #[test]
    #[ignore]
    fn openrouter_minimal_completion_smoke_from_stored_key() {
        let api_key = match openrouter_api_key_entry()
            .expect("credential entry should be available")
            .get_password()
        {
            Ok(value) if !value.trim().is_empty() => value,
            Ok(_) | Err(keyring::Error::NoEntry) => {
                eprintln!("No stored OpenRouter API key found; skipping paid API smoke.");
                return;
            }
            Err(err) => panic!("failed to read stored OpenRouter API key: {}", err),
        };

        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("HTTP client should build");

        let models_response: serde_json::Value = client
            .get("https://openrouter.ai/api/v1/models")
            .bearer_auth(&api_key)
            .header("HTTP-Referer", "https://github.com/oshtz/benchmaker")
            .header("X-Title", "Benchmaker Release Smoke")
            .send()
            .expect("model list request should complete")
            .error_for_status()
            .expect("model list request should succeed")
            .json()
            .expect("model list should be JSON");

        let models = models_response
            .get("data")
            .and_then(|value| value.as_array())
            .expect("model list should contain data array");
        let preferred_models = [
            "meta-llama/llama-3.1-8b-instruct:free",
            "mistralai/mistral-7b-instruct:free",
            "openai/gpt-4o-mini",
            "google/gemini-2.0-flash-lite-001",
        ];
        let selected_model = preferred_models
            .iter()
            .find(|candidate| {
                models.iter().any(|model| {
                    model
                        .get("id")
                        .and_then(|value| value.as_str())
                        .map(|id| id == **candidate)
                        .unwrap_or(false)
                })
            })
            .map(|value| value.to_string())
            .or_else(|| {
                models
                    .iter()
                    .find(|model| {
                        let prompt_price = model
                            .pointer("/pricing/prompt")
                            .and_then(|value| value.as_str())
                            .unwrap_or("1");
                        let completion_price = model
                            .pointer("/pricing/completion")
                            .and_then(|value| value.as_str())
                            .unwrap_or("1");
                        prompt_price == "0" && completion_price == "0"
                    })
                    .and_then(|model| model.get("id").and_then(|value| value.as_str()))
                    .map(|id| id.to_string())
            });

        let Some(model_id) = selected_model else {
            eprintln!("No preferred or free OpenRouter model found; skipping paid API smoke.");
            return;
        };

        let response = client
            .post("https://openrouter.ai/api/v1/chat/completions")
            .bearer_auth(&api_key)
            .header("HTTP-Referer", "https://github.com/oshtz/benchmaker")
            .header("X-Title", "Benchmaker Release Smoke")
            .json(&serde_json::json!({
                "model": model_id,
                "messages": [
                    { "role": "user", "content": "Reply with OK." }
                ],
                "max_tokens": 1,
                "temperature": 0
            }))
            .send()
            .expect("completion request should complete");

        let status = response.status();
        if !status.is_success() {
            let body = response.text().unwrap_or_default();
            panic!("completion request failed with status {}: {}", status, body);
        }
    }
}

// ============================================================================
// Updater
// ============================================================================

#[cfg(target_os = "windows")]
fn escape_powershell_literal(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(target_os = "macos")]
fn escape_bash_literal(value: &str) -> String {
    value.replace('\'', "'\\''")
}

#[tauri::command]
fn apply_update(app: AppHandle, update_path: String) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Err("Auto-update is disabled in dev builds.".to_string());
    }

    let update_file = Path::new(&update_path);
    if !update_file.exists() {
        return Err("Update file not found.".to_string());
    }

    let current_exe = std::env::current_exe().map_err(|err| err.to_string())?;
    let pid = std::process::id();

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "$procId = {pid}; $source = '{source}'; $target = '{target}'; while (Get-Process -Id $procId -ErrorAction SilentlyContinue) {{ Start-Sleep -Milliseconds 200 }}; Move-Item -Force $source $target; Start-Process $target",
            pid = pid,
            source = escape_powershell_literal(&update_file.to_string_lossy()),
            target = escape_powershell_literal(&current_exe.to_string_lossy()),
        );

        Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .spawn()
            .map_err(|err| err.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        // Get the .app bundle path (current_exe is inside .app/Contents/MacOS/)
        let app_bundle = current_exe
            .parent()  // MacOS/
            .and_then(|p| p.parent())  // Contents/
            .and_then(|p| p.parent())  // .app bundle
            .ok_or("Could not determine app bundle path")?;

        let script = format!(
            r#"
            pid={}
            source='{}'
            target='{}'
            
            while kill -0 $pid 2>/dev/null; do sleep 0.2; done
            rm -rf "$target"
            mv -f "$source" "$target"
            open "$target"
            "#,
            pid,
            escape_bash_literal(&update_file.to_string_lossy()),
            escape_bash_literal(&app_bundle.to_string_lossy()),
        );

        Command::new("bash")
            .args(["-c", &script])
            .spawn()
            .map_err(|err| err.to_string())?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return Err("Auto-update is not supported on this platform.".to_string());
    }

    app.exit(0);
    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn extract_app_zip(zip_path: String) -> Result<String, String> {
    let zip_file = Path::new(&zip_path);
    let parent = zip_file.parent().ok_or("Invalid zip path")?;

    // Use ditto to extract (preserves macOS attributes and code signatures)
    let status = Command::new("ditto")
        .args(["-xk", &zip_path, &parent.to_string_lossy().to_string()])
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("Failed to extract update".to_string());
    }

    // Return path to extracted .app
    let app_path = parent.join("Benchmaker.app");
    if !app_path.exists() {
        return Err("Extracted app not found".to_string());
    }

    // Clean up zip file
    std::fs::remove_file(zip_file).ok();

    Ok(app_path.to_string_lossy().to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn extract_app_zip(_zip_path: String) -> Result<String, String> {
    Err("This command is only available on macOS".to_string())
}

// ============================================================================
// Main
// ============================================================================

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Legacy commands (backwards compatible)
            read_snapshot,
            write_snapshot,
            // New normalized commands
            get_all_test_suites,
            save_test_suite,
            delete_test_suite,
            get_all_runs,
            save_run,
            delete_run,
            get_app_state,
            save_app_state,
            // Credential storage
            get_stored_api_key,
            save_api_key,
            clear_stored_api_key,
            // Updater commands
            apply_update,
            extract_app_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
