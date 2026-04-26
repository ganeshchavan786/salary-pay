import { openDB } from 'idb'

const DB_NAME = 'face-attendance-db'
const DB_VERSION = 1

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('employees')) {
      const employeeStore = db.createObjectStore('employees', { keyPath: 'id' })
      employeeStore.createIndex('emp_code', 'emp_code', { unique: true })
    }
    
    if (!db.objectStoreNames.contains('attendance')) {
      const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id' })
      attendanceStore.createIndex('emp_id', 'emp_id')
      attendanceStore.createIndex('date', 'date')
      attendanceStore.createIndex('sync_status', 'sync_status')
    }
  }
})

export const employeeDB = {
  async getAll() {
    const db = await dbPromise
    return db.getAll('employees')
  },
  
  async getById(id) {
    const db = await dbPromise
    return db.get('employees', id)
  },
  
  async save(employee) {
    const db = await dbPromise
    return db.put('employees', employee)
  },
  
  async saveMany(employees) {
    const db = await dbPromise
    const tx = db.transaction('employees', 'readwrite')
    await Promise.all([
      ...employees.map(emp => tx.store.put(emp)),
      tx.done
    ])
  },
  
  async clear() {
    const db = await dbPromise
    return db.clear('employees')
  }
}

export const attendanceDB = {
  async getAll() {
    const db = await dbPromise
    return db.getAll('attendance')
  },
  
  async getByDate(date) {
    const db = await dbPromise
    const index = db.transaction('attendance').store.index('date')
    return index.getAll(date)
  },
  
  async getPending() {
    const db = await dbPromise
    const index = db.transaction('attendance').store.index('sync_status')
    return index.getAll('PENDING')
  },
  
  async save(record) {
    const db = await dbPromise
    return db.put('attendance', record)
  },
  
  async updateStatus(id, status) {
    const db = await dbPromise
    const record = await db.get('attendance', id)
    if (record) {
      record.sync_status = status
      record.synced_at = new Date().toISOString()
      return db.put('attendance', record)
    }
  },
  
  async delete(id) {
    const db = await dbPromise
    return db.delete('attendance', id)
  }
}
