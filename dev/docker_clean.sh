read -p "Are you sure you want to clean all Docker containers, images, volumes, and networks? This action cannot be undone. (y/n): " confirm
if [[ "$confirm" != "y" ]]; then
  echo "Aborting."
  exit 0
fi

echo "Stopping and removing all Docker containers, images, volumes, and networks..."

docker stop $(docker ps -aq)
docker rm -f $(docker ps -aq)
docker rmi -f $(docker images -q)
docker volume rm -f $(docker volume ls -q)
docker network rm $(docker network ls -q)
docker system prune -a --volumes -f