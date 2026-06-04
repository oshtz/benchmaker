import { create } from 'zustand'
import type { TestSuite, TestCase } from '@/types'

interface TestSuiteState {
  testSuites: TestSuite[]
  activeTestSuiteId: string | null

  // Test Suite Actions
  createTestSuite: (name: string, description?: string) => TestSuite
  updateTestSuite: (id: string, updates: Partial<Omit<TestSuite, 'id' | 'createdAt'>>) => void
  deleteTestSuite: (id: string) => void
  setActiveTestSuite: (id: string | null) => void
  getActiveTestSuite: () => TestSuite | null

  // System Prompt Actions
  updateSystemPrompt: (testSuiteId: string, systemPrompt: string) => void
  updateJudgeSystemPrompt: (testSuiteId: string, judgeSystemPrompt: string) => void

  // Test Case Actions
  addTestCase: (testSuiteId: string, testCase: Omit<TestCase, 'id'>) => TestCase
  addTestCases: (testSuiteId: string, testCases: Omit<TestCase, 'id'>[]) => TestCase[]
  updateTestCase: (testSuiteId: string, testCaseId: string, updates: Partial<Omit<TestCase, 'id'>>) => void
  deleteTestCase: (testSuiteId: string, testCaseId: string) => void
  reorderTestCases: (testSuiteId: string, testCaseIds: string[]) => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const useTestSuiteStore = create<TestSuiteState>()((set, get) => ({
  testSuites: [],
  activeTestSuiteId: null,

  createTestSuite: (name, description) => {
    const newTestSuite: TestSuite = {
      id: generateId(),
      name,
      description,
      systemPrompt: '',
      judgeSystemPrompt: '',
      testCases: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((state) => ({
      testSuites: [...state.testSuites, newTestSuite],
      activeTestSuiteId: newTestSuite.id,
    }))
    return newTestSuite
  },

  updateTestSuite: (id, updates) => {
    set((state) => ({
      testSuites: state.testSuites.map((suite) =>
        suite.id === id ? { ...suite, ...updates, updatedAt: Date.now() } : suite
      ),
    }))
  },

  deleteTestSuite: (id) => {
    set((state) => ({
      testSuites: state.testSuites.filter((suite) => suite.id !== id),
      activeTestSuiteId:
        state.activeTestSuiteId === id ? null : state.activeTestSuiteId,
    }))
  },

  setActiveTestSuite: (id) => {
    set({ activeTestSuiteId: id })
  },

  getActiveTestSuite: () => {
    const state = get()
    return state.testSuites.find((s) => s.id === state.activeTestSuiteId) || null
  },

  updateSystemPrompt: (testSuiteId, systemPrompt) => {
    set((state) => ({
      testSuites: state.testSuites.map((suite) =>
        suite.id === testSuiteId
          ? { ...suite, systemPrompt, updatedAt: Date.now() }
          : suite
      ),
    }))
  },

  updateJudgeSystemPrompt: (testSuiteId, judgeSystemPrompt) => {
    set((state) => ({
      testSuites: state.testSuites.map((suite) =>
        suite.id === testSuiteId
          ? { ...suite, judgeSystemPrompt, updatedAt: Date.now() }
          : suite
      ),
    }))
  },

  addTestCase: (testSuiteId, testCaseData) => {
    const newTestCase: TestCase = {
      id: generateId(),
      ...testCaseData,
    }
    set((state) => ({
      testSuites: state.testSuites.map((suite) =>
        suite.id === testSuiteId
          ? {
              ...suite,
              testCases: [...suite.testCases, newTestCase],
              updatedAt: Date.now(),
            }
          : suite
      ),
    }))
    return newTestCase
  },

  addTestCases: (testSuiteId, testCasesData) => {
    const newTestCases: TestCase[] = testCasesData.map((tc) => ({
      id: generateId(),
      ...tc,
    }))
    set((state) => ({
      testSuites: state.testSuites.map((suite) =>
        suite.id === testSuiteId
          ? {
              ...suite,
              testCases: [...suite.testCases, ...newTestCases],
              updatedAt: Date.now(),
            }
          : suite
      ),
    }))
    return newTestCases
  },

  updateTestCase: (testSuiteId, testCaseId, updates) => {
    set((state) => ({
      testSuites: state.testSuites.map((suite) =>
        suite.id === testSuiteId
          ? {
              ...suite,
              testCases: suite.testCases.map((tc) =>
                tc.id === testCaseId ? { ...tc, ...updates } : tc
              ),
              updatedAt: Date.now(),
            }
          : suite
      ),
    }))
  },

  deleteTestCase: (testSuiteId, testCaseId) => {
    set((state) => ({
      testSuites: state.testSuites.map((suite) =>
        suite.id === testSuiteId
          ? {
              ...suite,
              testCases: suite.testCases.filter((tc) => tc.id !== testCaseId),
              updatedAt: Date.now(),
            }
          : suite
      ),
    }))
  },

  reorderTestCases: (testSuiteId, testCaseIds) => {
    set((state) => ({
      testSuites: state.testSuites.map((suite) => {
        if (suite.id !== testSuiteId) return suite
        const testCaseMap = new Map(suite.testCases.map((tc) => [tc.id, tc]))
        const reorderedTestCases = testCaseIds
          .map((id) => testCaseMap.get(id))
          .filter((tc): tc is TestCase => tc !== undefined)
        return {
          ...suite,
          testCases: reorderedTestCases,
          updatedAt: Date.now(),
        }
      }),
    }))
  },
}))
