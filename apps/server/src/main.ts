import process from 'node:process'
import { buildApp } from './app.ts'

const port = Number(process.env.PORT ?? 3001)

buildApp()
  .listen({ port, host: '0.0.0.0' })
  // eslint-disable-next-line no-console -- единственное сообщение сервера о том, что он запущен
  .then(() => console.log('server started'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
