// @flow

import type { Pattern } from 'value-matcher'

import { CancelToken, ignoreErrors } from 'promise-toolbox'
import { map as mapToArray } from 'lodash'
import { noSuchObject } from 'xo-common/api-errors'

import Collection from '../../collection/redis'
import patch from '../../patch'
import { asyncMap, serializeError } from '../../utils'

import type Logger from '../logs/loggers/abstract'
import { type Schedule } from '../scheduling'

import executeCall from './execute-call'

// ===================================================================

export type Job = {
  id: string,
  name: string,
  type: string,
  userId: string,
}

type ParamsVector =
  | {|
      items: Array<Object>,
      type: 'crossProduct',
    |}
  | {|
      mapping: Object,
      type: 'extractProperties',
      value: Object,
    |}
  | {|
      pattern: Pattern,
      type: 'fetchObjects',
    |}
  | {|
      collection: Object,
      iteratee: Function,
      paramName?: string,
      type: 'map',
    |}
  | {|
      type: 'set',
      values: any,
    |}

export type CallJob = {|
  ...$Exact<Job>,
  method: string,
  paramsVector: ParamsVector,
  timeout?: number,
  type: 'call',
|}

export type Executor = ({|
  app: Object,
  cancelToken: any,
  data: any,
  job: Job,
  logger: Logger,
  runJobId: string,
  schedule?: Schedule,
  session: Object,
|}) => Promise<any>

// -----------------------------------------------------------------------------

class JobsDb extends Collection {}

// -----------------------------------------------------------------------------

export default class Jobs {
  _app: any
  _executors: { __proto__: null, [string]: Executor }
  _jobs: JobsDb
  _logger: Logger
  _runningJobs: { __proto__: null, [string]: string }
  _runs: { __proto__: null, [string]: () => void }

  get runningJobs () {
    return this._runningJobs
  }

  constructor (xo: any) {
    this._app = xo
    const executors = (this._executors = { __proto__: null })
    const jobsDb = (this._jobs = new JobsDb({
      connection: xo._redis,
      prefix: 'xo:job',
      indexes: ['user_id', 'key'],
    }))
    this._logger = undefined
    this._runningJobs = { __proto__: null }
    this._runs = { __proto__: null }

    executors.call = executeCall

    xo.on('clean', () => jobsDb.rebuildIndexes())
    xo.on('start', () => {
      xo.addConfigManager(
        'jobs',
        () => jobsDb.get(),
        jobs => Promise.all(mapToArray(jobs, job => jobsDb.update(job))),
        ['users']
      )

      xo.getLogger('jobs').then(logger => {
        this._logger = logger
      })

      // it sends a report for the interrupted backup jobs
      this._app.on('plugins:registered', () =>
        asyncMap(this._jobs.get(), job => {
          // only the interrupted backup jobs have the runId property
          if (job.runId === undefined) {
            return
          }

          this._app.emit(
            'job:terminated',
            undefined,
            job,
            undefined,
            // This cast can be removed after merging the PR: https://github.com/vatesfr/xen-orchestra/pull/3209
            String(job.runId)
          )
          return this.updateJob({ id: job.id, runId: null })
        })
      )
    })
  }

  cancelJobRun (id: string) {
    const run = this._runs[id]
    if (run !== undefined) {
      return run.cancel()
    }
  }

  async getAllJobs (type?: string): Promise<Array<Job>> {
    // $FlowFixMe don't know what is the problem (JFT)
    const jobs = await this._jobs.get()
    const runningJobs = this._runningJobs
    const result = []
    jobs.forEach(job => {
      if (type === undefined || job.type === type) {
        job.runId = runningJobs[job.id]
        result.push(job)
      }
    })
    return result
  }

  async getJob (id: string, type?: string): Promise<Job> {
    let job = await this._jobs.first(id)
    if (job === null || (type !== undefined && job.properties.type !== type)) {
      throw noSuchObject(id, 'job')
    }

    job = job.properties
    job.runId = this._runningJobs[id]

    return job
  }

  async createJob (job: $Diff<Job, {| id: string |}>): Promise<Job> {
    return (await this._jobs.add(job)).properties
  }

  async updateJob (job: $Shape<Job>, merge: boolean = true) {
    if (merge) {
      const { id, ...props } = job
      job = await this.getJob(id)
      patch(job, props)
    }
    return /* await */ this._jobs.update(job)
  }

  registerJobExecutor (type: string, executor: Executor): void {
    const executors = this._executors
    if (type in executors) {
      throw new Error(`there is already a job executor for type ${type}`)
    }
    executors[type] = executor
  }

  async removeJob (id: string) {
    const promises = [this._jobs.remove(id)]
    ;(await this._app.getAllSchedules()).forEach(schedule => {
      if (schedule.jobId === id) {
        promises.push(this._app.deleteSchedule(schedule.id))
      }
    })
    return Promise.all(promises)
  }

  async _runJob (job: Job, schedule?: Schedule, data_?: any) {
    const { id } = job

    const runningJobs = this._runningJobs
    if (id in runningJobs) {
      throw new Error(`job ${id} is already running`)
    }

    const { type } = job
    const executor = this._executors[type]
    if (executor === undefined) {
      throw new Error(`cannot run job ${id}: no executor for type ${type}`)
    }

    let data
    if (type === 'backup') {
      // $FlowFixMe only defined for BackupJob
      const settings = job.settings['']
      data = {
        // $FlowFixMe only defined for BackupJob
        mode: job.mode,
        reportWhen: (settings && settings.reportWhen) || 'failure',
      }
    }

    const logger = this._logger
    const runJobId = logger.notice(`Starting execution of ${id}.`, {
      data,
      event: 'job.start',
      userId: job.userId,
      jobId: id,
      scheduleId: schedule?.id,
      // $FlowFixMe only defined for CallJob
      key: job.key,
      type,
    })

    // runId is a temporary property used to check if the report is sent after the server interruption
    this.updateJob({ id, runId: runJobId })::ignoreErrors()
    runningJobs[id] = runJobId

    const runs = this._runs

    const { cancel, token } = CancelToken.source()
    runs[runJobId] = { cancel }

    let session
    try {
      const app = this._app
      session = app.createUserConnection()
      session.set('user_id', job.userId)

      const status = await executor({
        app,
        cancelToken: token,
        data: data_,
        job,
        logger,
        runJobId,
        schedule,
        session,
      })
      logger.notice(`Execution terminated for ${job.id}.`, {
        event: 'job.end',
        runJobId,
      })

      app.emit('job:terminated', status, job, schedule, runJobId)
    } catch (error) {
      logger.error(`The execution of ${id} has failed.`, {
        event: 'job.end',
        runJobId,
        error: serializeError(error),
      })
      throw error
    } finally {
      ;this.updateJob({ id, runId: null })::ignoreErrors()
      delete runningJobs[id]
      delete runs[runJobId]
      if (session !== undefined) {
        session.close()
      }
    }
  }

  async runJobSequence (
    idSequence: Array<string>,
    schedule?: Schedule,
    data?: any
  ) {
    const jobs = await Promise.all(
      mapToArray(idSequence, id => this.getJob(id))
    )

    for (const job of jobs) {
      await this._runJob(job, schedule, data)
    }
  }
}
