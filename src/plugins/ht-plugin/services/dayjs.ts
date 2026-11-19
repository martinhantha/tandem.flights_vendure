// Filename : dayjs.ts

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/fr'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('en')

const DEFAULT_TIMEZONE = 'UTC'
dayjs.tz.setDefault(DEFAULT_TIMEZONE)

const timezonedDayjs = (date: string | Date | number = dayjs().toDate(), tz: string = DEFAULT_TIMEZONE) => {
	return dayjs(date instanceof (Date || dayjs.Dayjs) ? date.valueOf() : date).tz(tz)
}

const timezonedUnix = (value: number) => {
	return dayjs.unix(value).tz('UTC', false)
}


timezonedDayjs.unix = timezonedUnix

export default timezonedDayjs
