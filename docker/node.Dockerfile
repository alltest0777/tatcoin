FROM golang:1.20 as build

WORKDIR /app
COPY . .
RUN go mod tidy && go build -o /tatcoind ./cmd

FROM debian:bullseye
COPY --from=build /tatcoind /usr/local/bin/tatcoind
CMD ["tatcoind", "start"]