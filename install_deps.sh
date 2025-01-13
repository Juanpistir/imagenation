#!/bin/bash

# Instalar dependencias principales
npm install --save \
  ioredis \
  zod \
  @fastify/cookie \
  @fastify/session \
  @fastify/rate-limit \
  nodemailer \
  winston

# Instalar dependencias de desarrollo
npm install --save-dev \
  jest \
  supertest
